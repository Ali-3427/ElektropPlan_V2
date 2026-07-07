# ElektroPlan Frozen Decisions

This document records frozen choices from master plan sections 2.1, 2.4, 2.7, 3, and 6. M0 bootstrap must preserve these decisions exactly.

## Section 2.1: Physical Constants

- `RHO_COPPER_20 = 0.01724`
- `RHO_ALUMINUM_20 = 0.02826`
- `ALPHA_COPPER_20 = 0.00393`
- `ALPHA_ALUMINUM_20 = 0.00403`
- `SQRT3 = Math.sqrt(3)`
- `X_AC_FALLBACK_OHM_PER_KM = 0.08`
- `J_REF_COPPER = 4`
- `J_REF_ALUMINUM = 2.5`
- `HP_TO_KW = 0.7457`

## Section 2.4: Cable Sizing

- Cable sizing follows the locked 11-step ascending candidate scan algorithm from the plan.
- `S = I / J` is preliminary-only and must never be returned as final cable selection.
- The accepted installation method set is frozen to `A1`, `A2`, `B1`, `B2`, `C`, `D`, `E`.
- Voltage-drop limits come from versioned data profiles, not hardcoded constants.
- Correction factors `kT`, `kG`, `kH` must come from `calculation-data`, not hardcoded logic.

## Section 2.7: Renderer-Normalized Input Policy

- Formula Mode still validates against the strict core contract, but the renderer now normalizes placeholder-backed numeric fields to typed example defaults before sending requests to core.
- Three-phase Formula Mode still requires an explicit `voltageMode` selector in the UI, and the renderer preserves that selector only when phase is 3.
- The motor voltage control is phase-aware in the renderer: `1 faz => 220` and `3 faz => 380`.
- Renderer-applied defaults may appear in `AssumptionEntry` rows with `source: "default"` so saved results remain traceable.
- Core formulas and bridge contracts remain unchanged; validation stays strict on the normalized request.

## Section 3: System Modules

- Monorepo tooling is frozen to `pnpm workspaces` plus `turborepo`.
- TypeScript project references are enabled across packages.
- Package layout:
  - `packages/calculation-core`
  - `packages/calculation-data`
  - `packages/contracts`
  - `packages/storage`
  - `packages/exporters`
  - `apps/desktop/main`
  - `apps/desktop/preload`
  - `apps/desktop/renderer`
  - `tests/property`
  - `tests/e2e`
- Standards scope is IEC 60364 only for v1.

## Section 6: Data and Ruleset Integration

- Datasets live under `packages/calculation-data/src` and are accessed through typed accessors only.
- Required dataset/accessor pairs:
  - Installation methods mapping -> `INSTALLATION_METHOD_MAP` plus guard
  - Ampacity -> `getAmpacity`, `getStandardCrossSections`
  - Temperature factors -> `getTempFactor`
  - Grouping factors -> `getGroupingFactor`
  - Harmonic factors -> `getHarmonicFactor`
  - Motor ruler -> `getMotorTableEntries`, `getMotorTableEntryByKW`, `isVoltageAvailable`
  - Protection catalog -> `lookupProtectionDevice`
  - Voltage-drop profiles -> `getVoltageDropProfiles`, `getDefaultProfile`, `getProfileById`
- Every dataset file must carry `DatasetMetadata { id, standard, revision, source, validFrom, notes }`.
- Core modules must never hardcode ruleset tables.
- `dataVersion` changes independently from `engineVersion`.

## 2026-04-24 — Theme overhaul

- Brand palette landed: amber accent on white (light) + black (dark); new cream theme with orange accent.
- `ThemeContext` (`features/shared/theme/ThemeContext.tsx`) owns mode state and persistence. `data-theme` attribute drives `:root` blocks in `styles/theme.css`.
- Sidebar logo uses PNG + `object-fit: contain` with fixed 56px height wrapper (48px < 1280px width) → edge-to-edge scale, no crop.
- Added `--color-accent-*` and `--color-focus-ring` tokens so accent can diverge from functional primary. Focus rings across Input, SaveDialog, SettingsPage, ProjectsPage, RecordDetail now use `--color-focus-ring`.
- Sidebar footer: 3-way segmented control (Aydınlık / Koyu / Krem) replacing binary toggle.
- Settings page has theme picker Card with mini-swatch previews.
- Primary button text switched to near-black (`#1a1410`) for amber contrast.
- `sidebar-logo-cream.png` shipped as placeholder copy of light logo until dedicated asset provided.
