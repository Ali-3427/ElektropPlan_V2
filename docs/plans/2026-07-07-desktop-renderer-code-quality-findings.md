# apps/desktop renderer — Code Quality Findings (scan only)

> **Status: documentation only.** This is a scan report from `code-simplifier`, not an executed fix. No code in `apps/desktop/renderer` has been changed as a result of this document. Fixes will be planned and executed in a later session, on a dedicated branch, one task at a time.
>
> **Already tracked elsewhere:** `ProjectsPage.tsx` / `ProjectQuickPanel.tsx` duplication (draft state, create/duplicate/delete handlers) is already documented in `docs/plans/2026-06-26-code-quality-fixes.md` (Task 6) — not repeated here.

**Scope:** `apps/desktop/renderer/src` — `features/` (cable, materials, motor, projects, settings, shared, voltageDrop), `ui/` (shared design-system components), `hooks/`, `query/` (TanStack Query client + keys), `bridge/` (talks to Electron preload), `i18n/`, `styles/`, `router.tsx`, `app.tsx`, `main.tsx`.

---

## High impact

### F1 — Two conflicting state-persistence patterns across calculator pages

The four calculator modes split into two camps:
- **Mirror pattern (verbose/fragile):** `CableDetailedMode.tsx:296-373` declares ~18 `useState` hooks that duplicate `pageState` fields, then a giant `useEffect` re-syncs all of them back. Same pattern in `CableRulerMode.tsx:64-76` and `VoltageDropPage.tsx:91-130`.
- **Direct pattern (clean):** `FormulaMode.tsx:61` and `TableMode.tsx:41` destructure `pageState` and call `setPageState((current) => ...)` directly — no mirror state, no sync effect.

The mirror pattern is pure boilerplate that risks drift: a new field must be added in 3 places (state type, `useState`, and the effect dependency array). **This is the single largest simplification available in the renderer** — converge all four calculator pages on the direct pattern.

### F2 — Duplicated result-row component + CSS, 4×

`RRow` (`CableDetailedMode.tsx:699`), `ResultRow` (`CableRulerMode.tsx:207`, `FormulaMode.tsx:279`), and `TRow` (`TableMode.tsx:230`) are byte-for-byte identical components under different names. The backing CSS (`.resultRow`/`.resultLabel`/`.resultValue`/`.highlight`/`.resultGrid`) is copy-pasted across `CableDetailedMode`, `CableRulerMode`, `TableMode`, `FormulaMode` `.module.css` files.

**Fix:** extract one `ui/ResultRow.tsx` + shared styles; all four calculator pages import it.

### F3 — Query keys fragmented across 3+ sources

`query/keys.ts` is meant to be the central registry, but `materials`/`assignments` keys are defined ad-hoc instead:
- `MATERIAL_QUERIES` in `useMaterialsData.ts:4`
- raw literal arrays `["assignments"]` / `["materials"]` / `["group-cable-suggest"]` scattered across `materialMutations.ts:10,42,47`, `projectMutations.ts:89,99,109`, `useRecordAssignments.ts:7`, `ProjectQuickPanel.tsx:466,499`, `AssignMaterialPopover.tsx:120`, `BulkEditDialog.tsx:131`

Cache-invalidation correctness now depends on string literals matching by hand across 8 files. **Fix:** fold all of these into `query/keys.ts` as the single source of truth.

---

## Medium impact

### F4 — Inconsistent race-guarding on submit

- `FormulaMode.tsx:66,111-133` correctly guards stale async responses with a `requestSeq` ref.
- `VoltageDropPage.tsx:106` uses an in-flight ref.
- `CableDetailedMode.handleSubmit` (line 449), `CableRulerMode` (line 88), and `TableMode.handleCalc` (line 64) have **no** guard — a slow response can overwrite state from a newer request.

**Fix:** standardize on one guarding pattern (likely the `requestSeq` ref from `FormulaMode`) across all submit handlers.

### F5 — Inconsistent `isBridgeAvailable()` gating

Cable/motor/projects queries set `enabled: isBridgeAvailable()`, but `useMaterialsData.ts:11,18` and `useRecordAssignments.ts` omit it — materials queries fire (and throw) when the Electron bridge is absent (e.g. running the renderer standalone in a browser or test harness).

---

## Low impact

- **F6** — Dead code: `usePersistentPageState` returns a 3-tuple `[value, setValue, reset]` (`usePersistentPageState.ts:80`), but no call site destructures the third element anywhere. Drop it or wire it up.
- **F7** — Redundant re-export: `materialMutations.ts:4` imports `MATERIAL_QUERIES` then re-exports it again at line 61 — pointless indirection; consumers should import from `useMaterialsData` directly.
- **F8** — Large files: `VoltageDropPage.tsx` (708 lines) and `ProjectsPage.tsx` (609 lines, tracked separately per the note above) dominate the renderer. In `VoltageDropPage`, the ~170-line advanced-settings `<Field>` grid (lines 497-666) is an obvious extraction into a `VoltageDropSettingsForm` component.

---

## Suggested order for the work phase (not started yet)

1. **F1** — the mirror→direct state-pattern convergence; touches the most files but is mechanical and behavior-preserving once the pattern from `FormulaMode`/`TableMode` is confirmed correct. Do this before F2/F4 since both touch the same pages.
2. **F2** — extract shared `ResultRow`; natural follow-on once F1 has simplified the surrounding component bodies.
3. **F3** — consolidate query keys; independent of F1/F2, but touches many files — do as its own isolated change with careful before/after cache-invalidation testing (create/edit/delete a material or assignment and confirm the UI updates without a manual refresh).
4. **F4** — standardize race-guarding; do after F1 since the guard lives in the same handlers being restructured.
5. **F5, F6, F7, F8** — low-risk, mechanical, safe to batch.

**Verify commands:**
- `cd apps/desktop/renderer && npx tsc --noEmit`
- No renderer test harness exists yet (per the `2026-06-26` plan) — verification is typecheck + manual exercise of each calculator page (cable, motor, voltage drop) and the materials/projects flows after any F1/F3/F4 change.
