# Voltage Drop Group Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voltage-drop group calculations match the provided Excel example and support per-segment technical settings without regressing project save flows.

**Architecture:** Keep the pure calculation in `packages/calculation-core`, extend contracts and bridge DTOs, then update the renderer state and display. Defaults are stored through the existing settings API and used only as initial UI values; each segment can override those defaults.

**Tech Stack:** TypeScript, Zod, Vitest, React/Vite, Electron IPC, existing settings and records services.

---

### Task 1: Core Calculation Contract

**Files:**
- Modify: `packages/calculation-core/src/voltage-drop-group/types.ts`
- Modify: `packages/calculation-core/src/voltage-drop-group/defaults.ts`
- Modify: `packages/calculation-core/src/voltage-drop-group/algorithm.ts`
- Modify: `packages/calculation-core/src/voltage-drop-group/index.test.ts`

- [ ] Add failing tests for the Excel 7-segment example: default three-phase, fixed 4 mm2 copper on first six segments, fixed 95 mm2 aluminum on last segment, total voltage drop about 2.70%.
- [ ] Remove automatic phase selection from the active calculation model; default to three-phase unless user selects single-phase.
- [ ] Add per-segment settings overrides and optional fixed `sectionMm2`.
- [ ] Calculate each segment from its own entered power/current, not by accumulating power into upstream sections.
- [ ] Sum segment voltage drops for total/max group voltage drop.

### Task 2: Contracts And Bridge Types

**Files:**
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `packages/contracts/src/schema.test.ts`
- Modify: `apps/desktop/renderer/src/bridge/types.ts`
- Modify if needed: `apps/desktop/main/src/services/calculate-service.ts`

- [ ] Extend request/output schemas with segment-level settings and selected/fixed section metadata.
- [ ] Preserve old saved `phaseMode: "auto"` parsing for backwards compatibility where practical.
- [ ] Add schema tests for per-segment copper/aluminum mix.

### Task 3: Renderer Defaults And Segment UI

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.module.css`

- [ ] Load saved voltage-drop-group defaults from settings and use them for initial state.
- [ ] Add settings controls to change default advanced values.
- [ ] Remove auto phase from UI and make three-phase the default.
- [ ] Add per-segment advanced controls for material, section, installation method, and related fields.
- [ ] Present compact segment result cards/table without page-level horizontal scrolling.
- [ ] Put assumptions and optimization steps behind collapsible controls.

### Task 4: Project Save Flow

**Files:**
- Modify: `apps/desktop/renderer/src/ui/SaveDialog.tsx`
- Modify if needed: `apps/desktop/renderer/src/features/projects/*`

- [ ] Ensure voltage-drop-group can be saved directly under a project, creating a group named after the calculation when no child group is selected.
- [ ] Keep motor current totals motor-only.
- [ ] Verify project record detail still opens old and new records.

### Task 5: Verification

- [ ] Run `pnpm --filter @elektroplan/calculation-core test -- --run voltage-drop-group`.
- [ ] Run `pnpm --filter @elektroplan/contracts test`.
- [ ] Run desktop renderer/main/preload typechecks.
- [ ] Run broader targeted tests where feasible.
