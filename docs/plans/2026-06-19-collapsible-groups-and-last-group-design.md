# Design: Collapsible Groups + Last-Used Group Default

Date: 2026-06-19

## Problem

1. Groups in the Quick Panel and Projects page render fully expanded, making long
   lists hard to scan.
2. When saving a motor (or any) calculation to a group, the group dropdown always
   defaults to the first group, forcing the user to re-pick the intended group
   every time.

## Decisions

- Accordion default state: **all groups collapsed**, expand state persisted in
  localStorage. Absent id = collapsed.
- Last-used group memory scope: **per project** (`{ [projectId]: groupId }`).

## Feature 1 — Collapsible groups

New hook `useCollapsibleGroups(storageKey)`:

- State: array of **expanded** group ids, persisted to localStorage under
  `storageKey`.
- API: `isExpanded(id): boolean` (default false), `toggle(id): void`.
- Storage failures are swallowed (best-effort), matching existing patterns.

Keys:
- Quick Panel → `elektroplan.quickPanel.expandedGroups`
- Projects page → `elektroplan.projects.expandedGroups`

`ProjectQuickPanel.tsx`: each group `<section>` gets a chevron toggle in its
header. When collapsed, hide the cable block, record list, and duplicate form;
keep header (title, record count, total current) visible.

`ProjectsPage.tsx`: each group `<article>` header gets a chevron. When collapsed,
hide `duplicateRow`, `cableGrid`, cable error, and record list. Clicking the
header both sets the group active and toggles expand.

## Feature 2 — Last-used group per project

New util `lastGroupStore` (localStorage map `{ [projectId]: groupId }`):
- `getLastGroup(projectId): string | undefined`
- `setLastGroup(projectId, groupId): void`
- Storage key `elektroplan.lastGroupByProject`.

`SaveDialog.tsx`:
- Group-default effect order: `currentGroupId` (record already assigned & in
  project) → `getLastGroup(activeProject.id)` if still present in the project →
  first group (existing behavior). `voltage-drop-group` keeps NONE fallback.
- On successful save, call `setLastGroup(projectId, groupId)` when both are real
  (not NONE / not undefined).

## Verification

Repo has no test runner (`test` script is a no-op). Verify via:
- `tsc --noEmit` on the renderer.
- Electron diagnostic harness against the built renderer: toggle a group and
  confirm body visibility; open SaveDialog twice and confirm the second open
  defaults to the previously saved group.
