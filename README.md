# ElektroPlan

Desktop app for electrical engineering calculations, built on IEC 60364-5-52.

**Download:** [latest release (v1.8.0)](https://github.com/Ali-3427/ElektropPlan_V2/releases/tag/v1.8.0) — portable exe or Windows installer.

## What it does

- **Cable sizing** — ampacity, correction factors (temperature, grouping, harmonics), installation methods (A1/A2/B1/B2/C/D/E), standard section selection
- **Motor calculations** — input/apparent power, current (1-phase and 3-phase LL/LN), formula mode and table mode
- **Voltage drop** — single segment, grouped segments, and full segment-tree topologies with optimizer
- **Protection coordination** — breaker/fuse catalog lookup against cable ampacity
- **Materials catalog** — categorized material database with Excel import/export
- **Project records** — save, assign materials, and revisit past calculations

## Stack

Electron desktop app (main / preload / renderer) + shared calculation packages, managed as a pnpm + Turborepo monorepo.

```
apps/
  desktop/
    main/       # Electron main process — IPC, services (calculate, materials, records, export, settings)
    preload/    # contextBridge API surface
    renderer/   # React UI (feature-based: cable, motor, voltageDrop, materials, projects, settings)
packages/
  calculation-core/   # calculation engine (cable, motor, voltage-drop, protection)
  calculation-data/   # IEC reference datasets (ampacity, grouping/temperature/harmonic factors, protection catalog)
  storage/            # SQLite-backed repositories (better-sqlite3)
  contracts/          # shared types/schemas (zod)
  exporters/          # Excel/PDF/JSON export
tests/
  e2e/                # Playwright
  property/           # property-based tests
  worked-examples/    # fixture-driven calculation verification
```

## Development

```bash
pnpm install
pnpm dev       # via turbo, per-app dev scripts
pnpm build
pnpm test
pnpm typecheck
```

better-sqlite3 is a native module — after any Electron/Node version change, rebuild for Electron's ABI (`npmRebuild: true` in the electron-builder config handles this on packaging).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
