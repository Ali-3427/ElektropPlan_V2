# ElektroPlan — Code Quality Bug-Fix Plan

> **For the coding agent:** Execute task-by-task, top to bottom. Each task is self-contained: it states the bug source, the fix, exact files/lines, and a verification command. **This repo has NO git** — do not run `git` commands. "Checkpoint" steps mean: run the stated verify command and confirm the expected output before moving on. Do NOT produce a new production build unless explicitly told.

**Goal:** Resolve the code-quality findings from the 2026-06-26 review: broken package encapsulation, dead defensive code, non-atomic delete, Electron hardening gaps, IPC redundancy, and the ProjectsPage/QuickPanel duplication.

**Architecture:** pnpm + Turborepo monorepo. Electron app under `apps/desktop` (`main` / `preload` / `renderer`). Shared logic in `packages/*`. SQLite via `better-sqlite3` in `packages/storage`. Validation via `zod` in `packages/contracts`. Renderer is React + TanStack Query.

**Tech Stack:** TypeScript 5.8, React, TanStack Query, Electron, better-sqlite3, zod, vitest, turbo.

**Verify commands (run from repo root):**
- Typecheck everything: `pnpm typecheck`
- Lint: `pnpm lint`
- Storage tests: `pnpm --filter @elektroplan/storage test`
- Renderer typecheck only: `cd apps/desktop/renderer && npx tsc --noEmit`

**Workspace package names** (for `pnpm --filter`): renderer = `@elektroplan/desktop-renderer`, main = `@elektroplan/desktop-main`, preload = `@elektroplan/desktop-preload`, storage = `@elektroplan/storage`, contracts = `@elektroplan/contracts`.

**Task order & risk:**
1. Task 1 — deep relative imports (trivial, do first)
2. Task 2 — dead bridge defensive code (trivial)
3. Task 3 — IPC double-parse (trivial)
4. Task 4 — DB CASCADE migration + atomic delete (HIGH risk, careful)
5. Task 5 — Electron navigation hardening (low risk)
6. Task 6 — Projects/QuickPanel duplication refactor (HIGH effort, do last / separate session)

> **Already fixed in a previous session (do NOT redo):** group-header overlap in `ProjectQuickPanel`, and hiding the quick panel on the `/projects` route in `Layout`.

---

## Task 1: Replace deep relative imports with the package alias

**Bug source:** `useProjectsData.ts` and `projectMutations.ts` import `project-marker` by reaching six directory levels up directly into another package's `src`:
```ts
import { ... } from "../../../../../../packages/contracts/src/project-marker";
```
This bypasses the `@elektroplan/contracts` public entry, breaks package encapsulation, and shatters on any directory move. The symbols are **already** re-exported from the package root (`packages/contracts/src/index.ts:2` → `export * from "./project-marker.js"`), so the alias import is a drop-in.

**Fix:** import from `@elektroplan/contracts` like the rest of the codebase.

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/useProjectsData.ts:3-6`
- Modify: `apps/desktop/renderer/src/features/projects/projectMutations.ts:2`

**Step 1 — useProjectsData.ts**

Replace:
```ts
import {
  PROJECT_MARKER_TAG,
  isProjectGroup,
} from "../../../../../../packages/contracts/src/project-marker";
```
with:
```ts
import { PROJECT_MARKER_TAG, isProjectGroup } from "@elektroplan/contracts";
```

**Step 2 — projectMutations.ts**

Replace:
```ts
import { PROJECT_MARKER_TAG } from "../../../../../../packages/contracts/src/project-marker";
```
with:
```ts
import { PROJECT_MARKER_TAG } from "@elektroplan/contracts";
```

**Step 3 — Confirm the renderer already depends on the contracts package**

Check `apps/desktop/renderer/package.json` for `"@elektroplan/contracts"` in `dependencies`. If missing, add `"@elektroplan/contracts": "workspace:*"` (match the version syntax used by sibling deps in that file) and run `pnpm install`.

**Step 4 — Checkpoint**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: no errors (no "Cannot find module" for `@elektroplan/contracts`).

---

## Task 2: Remove dead defensive code around `groupCableSuggest`

**Bug source:** `useProjectsData.ts` treats `bridge.calc.groupCableSuggest` as possibly-undefined via a custom intersection type and `typeof === "function"` guards:
```ts
type BridgeCalcWithGroupSuggestion = ReturnType<typeof getBridge>["calc"] & {
  groupCableSuggest?: (totalCurrentA: number) => Promise<GroupCableSuggestionResult | null>;
};
```
But the bridge contract declares `groupCableSuggest` as a **required** method (`apps/desktop/preload/src/index.ts:199`). The optionality + guards are stale leftovers from before the method shipped — dead branches that obscure intent.

**Fix:** drop the custom type and the optional-call/guard; call the method directly.

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/useProjectsData.ts` (lines ~68-70, ~210, ~212-227)

**Step 1 — Delete the custom type** (lines ~68-70):
```ts
type BridgeCalcWithGroupSuggestion = ReturnType<typeof getBridge>["calc"] & {
  groupCableSuggest?: (totalCurrentA: number) => Promise<GroupCableSuggestionResult | null>;
};
```
Remove it entirely.

**Step 2 — Simplify the bridge handle** (line ~210):
```ts
const calcBridge = isBridgeAvailable() ? (getBridge().calc as BridgeCalcWithGroupSuggestion) : null;
```
becomes:
```ts
const calcBridge = isBridgeAvailable() ? getBridge().calc : null;
```

**Step 3 — Simplify the query** (lines ~212-227). The `queryFn` and `enabled` lose the optional chaining and `typeof` guard:
```ts
queryFn: () => calcBridge?.groupCableSuggest(group.totalCurrentA) ?? Promise.resolve(null),
enabled:
  enableCableSuggestions &&
  isBridgeAvailable() &&
  group.totalCurrentA > 0,
```
(Keep `calcBridge?.` because `calcBridge` is still `null` when the bridge is unavailable; only the `groupCableSuggest?.` and `typeof calcBridge?.groupCableSuggest === "function"` parts are removed.)

**Step 4 — Checkpoint**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: no errors. If TS complains that `groupCableSuggest`'s return type is `GroupCableSuggestionResult` (not `... | null`), keep the `?? Promise.resolve(null)` — it is still valid.

---

## Task 3: Remove the duplicated `assertOptionalGroupId` call in the IPC handler

**Bug source:** `register.ts` parses the same payload twice in the `RecordsList` handler:
```ts
(_event, payload) =>
  services.records.listRecords(
    assertOptionalGroupId(payload) === undefined
      ? undefined
      : { groupId: assertOptionalGroupId(payload)! },
  ),
```
`assertOptionalGroupId(payload)` runs twice and forces a non-null assertion. Redundant work + a `!` smell.

**Fix:** parse once into a local.

**Files:**
- Modify: `apps/desktop/main/src/ipc/register.ts:306-316`

**Step 1 — Replace the handler body:**
```ts
secureHandle(
  ipcMain,
  IPC_CHANNELS.RecordsList,
  securityOptions,
  (_event, payload) => {
    const groupId = assertOptionalGroupId(payload);
    return services.records.listRecords(
      groupId === undefined ? undefined : { groupId },
    );
  },
);
```

**Step 2 — Checkpoint**

Run: `pnpm --filter @elektroplan/* exec tsc -b` on the main package, or `cd apps/desktop/main && npx tsc --noEmit`.
Expected: no errors.

---

## Task 4: Move project/group delete cascade into the database (atomic CASCADE)

**Decision (confirmed with product owner):** deleting a project or group must delete its descendant groups, records, and material assignments.

**Bug source:** today the cascade is performed in the renderer (`projectMutations.ts:102-138`) as a loop of sequential `await bridge.records.delete(...)` then `bridge.groups.delete(...)`. This is:
- **Not atomic** — a failure midway leaves orphaned/partial data.
- **Chatty** — N IPC round-trips per delete.
- **Redundant with the DB**, which currently uses `ON DELETE SET NULL` (so a direct group delete would silently orphan records instead of deleting them).

**Fix:** make the database own referential integrity with `ON DELETE CASCADE` along the whole chain (`groups.parent_group_id` → child groups; `records.grouping_group_id` → records; `material_assignments.record_id` → assignments, already CASCADE). Then collapse the renderer cascade to a single group delete.

> ⚠️ **SQLite gotcha — read before writing the migration.** SQLite cannot `ALTER` a foreign-key constraint; the table must be rebuilt (create new → copy → drop old → rename). During the drop, **foreign-key enforcement must be OFF**, otherwise dropping `records` will cascade-delete every `material_assignments` row (data loss). `PRAGMA foreign_keys` is a **no-op inside a transaction**, and the existing migration runner wraps each migration in a transaction (`migrations.ts:169`). So this migration needs a special path that toggles the pragma outside the wrapping transaction.

**Files:**
- Modify: `packages/storage/src/migrations.ts`
- Modify: `apps/desktop/renderer/src/features/projects/projectMutations.ts:102-138`
- Test: `packages/storage/src/index.test.ts` (or a new `packages/storage/src/cascade-delete.test.ts`)

### Step 1 — Write the failing test first

Add to `packages/storage/src/index.test.ts` (adapt imports/helpers to the file's existing patterns for opening an in-memory DB):

```ts
import { describe, expect, it } from "vitest";
// reuse the existing test helper that opens a migrated in-memory database

describe("cascade delete", () => {
  it("deletes child groups, records, and assignments when a project group is deleted", () => {
    const { repositories } = openTestDatabase(); // existing helper in this test file

    const project = repositories.groups.upsert({
      id: "proj-1", title: "P", tags: ["project"], version: { contractVersion: "1" },
    });
    const child = repositories.groups.upsert({
      id: "grp-1", title: "G", parentGroupId: "proj-1", version: { contractVersion: "1" },
    });
    const record = repositories.records.upsert(buildRecordFixture({ id: "rec-1", groupId: "grp-1" }));
    repositories.assignments.upsert(buildAssignmentFixture({ id: "asg-1", recordId: "rec-1" }));

    expect(repositories.groups.delete("proj-1")).toBe(true);

    expect(repositories.groups.getById("grp-1")).toBeNull();
    expect(repositories.records.getById("rec-1")).toBeNull();
    expect(repositories.assignments.listForRecords(["rec-1"])).toHaveLength(0);
  });
});
```

> If `buildRecordFixture` / `buildAssignmentFixture` / `openTestDatabase` don't already exist, create minimal versions matching the zod contract shapes (`calculationRecordSchema`, `materialAssignmentSchema`). Look at `packages/storage/src/material-repos.test.ts` for existing fixture style.

### Step 2 — Run the test, confirm it fails

Run: `pnpm --filter @elektroplan/storage exec vitest run src/index.test.ts -t "cascade delete"`
Expected: FAIL — child group and record still exist (current schema is `SET NULL`, and project→child uses `SET NULL` so the child survives).

### Step 3 — Refactor the migration runner to allow a self-managed migration

In `packages/storage/src/migrations.ts`, extend the `Migration` interface with an optional flag and honor it in `applyMigrations`:

```ts
export interface Migration {
  id: number;
  name: string;
  /** When true, the migration manages its own transaction(s); the runner will NOT wrap it. */
  managesOwnTransaction?: boolean;
  up(database: SqliteDatabase): void;
}
```

In `applyMigrations`, replace the single `runMigration` transaction wrapper with branch logic:

```ts
const insertMigration = database.prepare(
  "INSERT INTO schema_migrations (id, name, applied_at) VALUES (@id, @name, @applied_at)",
);

const recordMigration = (migration: Migration) =>
  insertMigration.run({
    applied_at: new Date().toISOString(),
    id: migration.id,
    name: migration.name,
  });

const runWrapped = database.transaction((migration: Migration) => {
  migration.up(database);
  recordMigration(migration);
});

for (const migration of migrations) {
  if (appliedIds.has(migration.id)) continue;
  if (migration.managesOwnTransaction) {
    migration.up(database);
    recordMigration(migration);
  } else {
    runWrapped(migration);
  }
}
```

### Step 4 — Add migration 4 (the table rebuild)

Append to the `migrations` array in `packages/storage/src/migrations.ts`:

```ts
{
  id: 4,
  name: "p4_cascade_delete_groups_records",
  managesOwnTransaction: true,
  up(database) {
    // FK pragma cannot change inside a transaction; ensure it is OFF for the rebuild.
    database.exec("PRAGMA foreign_keys = OFF;");
    try {
      database.exec("BEGIN;");

      // --- Rebuild groups with parent_group_id ON DELETE CASCADE ---
      database.exec(`
        CREATE TABLE groups_new (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          parent_group_id TEXT NULL REFERENCES groups(id) ON DELETE CASCADE,
          order_value INTEGER NULL,
          tags_json TEXT NULL,
          version_contract TEXT NOT NULL,
          version_engine TEXT NULL,
          version_data TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO groups_new SELECT
          id, title, parent_group_id, order_value, tags_json,
          version_contract, version_engine, version_data, created_at, updated_at
        FROM groups;
        DROP TABLE groups;
        ALTER TABLE groups_new RENAME TO groups;

        CREATE INDEX IF NOT EXISTS idx_groups_parent_group_id ON groups(parent_group_id);
        CREATE INDEX IF NOT EXISTS idx_groups_order_value ON groups(order_value, title, id);
      `);

      // --- Rebuild records with grouping_group_id ON DELETE CASCADE ---
      database.exec(`
        CREATE TABLE records_new (
          id TEXT PRIMARY KEY,
          calculator TEXT NOT NULL,
          title TEXT NULL,
          grouping_group_id TEXT NULL REFERENCES groups(id) ON DELETE CASCADE,
          grouping_group_path_json TEXT NULL,
          grouping_group_title TEXT NULL,
          grouping_order_value INTEGER NULL,
          grouping_quantity INTEGER NULL,
          grouping_tags_json TEXT NULL,
          input_json TEXT NOT NULL,
          output_json TEXT NOT NULL,
          version_contract TEXT NOT NULL,
          version_engine TEXT NULL,
          version_data TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO records_new SELECT
          id, calculator, title, grouping_group_id, grouping_group_path_json,
          grouping_group_title, grouping_order_value, grouping_quantity, grouping_tags_json,
          input_json, output_json, version_contract, version_engine, version_data,
          created_at, updated_at
        FROM records;
        DROP TABLE records;
        ALTER TABLE records_new RENAME TO records;

        CREATE INDEX IF NOT EXISTS idx_records_grouping_group_id ON records(grouping_group_id);
        CREATE INDEX IF NOT EXISTS idx_records_calculator ON records(calculator);
        CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records(updated_at DESC, id);
      `);

      // material_assignments.record_id already has ON DELETE CASCADE (migration 3) — chain complete.

      database.exec("PRAGMA foreign_key_check;"); // throws if any FK is now violated
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    } finally {
      database.exec("PRAGMA foreign_keys = ON;");
    }
  },
},
```

> Note: `material_assignments.record_id` references `records(id)`. Because we rebuild `records` with FK enforcement OFF, the assignments are preserved (no cascade fires during the drop), and `foreign_key_check` confirms they still point at valid record ids afterward.

### Step 5 — Run the storage test, confirm it passes

Run: `pnpm --filter @elektroplan/storage exec vitest run src/index.test.ts -t "cascade delete"`
Expected: PASS.

Then run the full storage suite to catch regressions:
Run: `pnpm --filter @elektroplan/storage exec vitest run`
Expected: all PASS.

### Step 6 — Simplify the renderer delete mutations

Now the DB cascades, so the renderer should stop manually deleting records/child-groups. In `projectMutations.ts`:

Replace `deleteProjectMutation` (lines ~102-124) with:
```ts
const deleteProjectMutation = useMutation({
  mutationFn: async (projectId: string) => getBridge().groups.delete(projectId),
  onSuccess: async () => {
    await Promise.all([
      invalidateProjectsQueries(queryClient),
      queryClient.invalidateQueries({ queryKey: ["assignments"] }),
    ]);
  },
});
```

Replace `deleteGroupMutation` (lines ~126-138) with:
```ts
const deleteGroupMutation = useMutation({
  mutationFn: async (groupId: string) => getBridge().groups.delete(groupId),
  onSuccess: async () => {
    await Promise.all([
      invalidateProjectsQueries(queryClient),
      queryClient.invalidateQueries({ queryKey: ["assignments"] }),
    ]);
  },
});
```

Then remove the now-unused helpers `loadHierarchy` and `deleteRecords` (lines ~22-38) **only if no other mutation references them** — grep first:
Run: `grep -n "loadHierarchy\|deleteRecords" apps/desktop/renderer/src/features/projects/projectMutations.ts`
If the only remaining hits are the definitions, delete them.

### Step 7 — Checkpoint

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: no errors, no "unused variable" complaints for removed helpers.

### Step 8 — Manual smoke (when the user later runs the app)

Document for the user to verify by hand (do not build now): create a project → add a group → add a manual current → assign a material → delete the project. Expect the project, group, record, and assignment all to disappear, and no orphaned rows to remain.

---

## Task 5: Electron navigation & window hardening

**Bug source:** `createMainWindow` (`apps/desktop/main/src/index.ts:32-60`) sets strong `webPreferences` (`contextIsolation: true`, `nodeIntegration: false`) but never restricts navigation or new-window creation. A compromised/buggy renderer (or a stray `window.open` / link) could navigate the main frame to an arbitrary origin or spawn an unrestricted window. Also `sandbox: false` is weaker than necessary.

**Fix:** deny new windows, block navigation to anything outside the trusted origin (dev server in dev, `file://` in prod), and attempt `sandbox: true`.

**Files:**
- Modify: `apps/desktop/main/src/index.ts`

**Step 1 — Add a navigation guard helper** near the top of `index.ts`:
```ts
function hardenWindow(window: BrowserWindow): void {
  // Never allow the renderer to open new windows.
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Block navigation away from the trusted origin.
  window.webContents.on("will-navigate", (event, url) => {
    const allowed =
      isDevelopment && devServerUrl
        ? url.startsWith(devServerUrl)
        : url.startsWith("file://");
    if (!allowed) {
      event.preventDefault();
    }
  });
}
```

**Step 2 — Call it in `createMainWindow`**, right after the `BrowserWindow` is constructed (before `loadURL`/`loadFile`):
```ts
hardenWindow(mainWindow);
```

**Step 3 — Try enabling the sandbox.** Change `sandbox: false` to `sandbox: true` in `webPreferences` (`index.ts:44`). The preload only uses `contextBridge` + `ipcRenderer`, both sandbox-compatible.

**Step 4 — Checkpoint**

Run: `cd apps/desktop/main && npx tsc --noEmit`
Expected: no errors.

**Step 5 — Verification note for the user (no build now):** when next launched, confirm the app window still loads the renderer and IPC calls work. If `sandbox: true` breaks preload loading, revert that single line to `sandbox: false` and keep the navigation guards (they are the higher-value change). Record the outcome.

---

## Task 6: De-duplicate ProjectsPage and ProjectQuickPanel

**Bug source:** `ProjectsPage.tsx` (791 lines) and `ProjectQuickPanel.tsx` (731 lines) both implement the same project/group workflow — create project, create group, duplicate group, add manual current, edit record quantity, manage material assignments — with near-identical local draft state and form/render logic. The data layer is already shared (`useProjectsData`, `useProjectMutations`), but the UI + draft-state layer is copy-pasted. This is the root cause of the manual-current UI bug fixed earlier: the same feature lived in two places and diverged.

> ⚠️ **No renderer test harness exists.** The renderer package has no vitest setup; verification here is `tsc --noEmit` plus the user running the app. Keep each extraction small and behavior-preserving. This is a **refactor, not a redesign** — do not change visible behavior.

**Fix:** extract the shared draft-state + submit logic into one hook, and the repeated visual blocks into presentational components. Both pages compose these.

**Files:**
- Create: `apps/desktop/renderer/src/features/projects/useGroupDrafts.ts`
- Create: `apps/desktop/renderer/src/features/projects/components/ManualCurrentForm.tsx`
- Create: `apps/desktop/renderer/src/features/projects/components/InlineCreateForm.tsx`
- Modify: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx`
- Modify: `apps/desktop/renderer/src/features/projects/ProjectsPage.tsx`

**Step 1 — Inventory the duplicated logic.** Run:
```
grep -n "submitCreateProject\|submitCreateGroup\|submitDuplicateGroup\|submitManualCurrent\|commitQuantity" apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx
grep -n "handleCreateProject\|handleCreateGroup\|handleDuplicateGroup\|handleCreateManualCurrent\|handleQuantityChange" apps/desktop/renderer/src/features/projects/ProjectsPage.tsx
```
List every handler pair that exists in both files. These are the extraction targets.

**Step 2 — Create `useGroupDrafts.ts`.** Move the draft state currently duplicated in both components into one hook:
- `projectDraft`, `groupDraft`, `duplicateDrafts`, `manualDrafts`, `quantityDrafts` state
- `updateManualDraft`, `submit*`/`handle*` callbacks, `runAction` error wrapper
- It should accept the active project + `useProjectMutations()` result and return `{ drafts, actions, actionError }`.

Keep the exact same validation rules as the current `ProjectQuickPanel.submitManualCurrent` (currentA finite & > 0; quantity truncated, optional). Do not change them.

**Step 3 — Create `ManualCurrentForm.tsx`.** Extract the three-input inline form (label / current A / quantity + submit) currently inlined in both files into one presentational component taking `value`, `onChange`, `onSubmit`, `onCancel`, `disabled`. Reuse it in both pages.

**Step 4 — Create `InlineCreateForm.tsx`.** Extract the repeated "input + Olustur" inline form pattern (used for create-project, create-group, duplicate-group) into one small component.

**Step 5 — Rewire `ProjectQuickPanel.tsx`** to consume `useGroupDrafts` + the new components. Delete the local copies of the moved state/handlers. Preserve the markup/classnames already in `ProjectQuickPanel.module.css` (including the `groupActions` row fixed earlier).

**Step 6 — Checkpoint after QuickPanel rewire**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: no errors.

**Step 7 — Rewire `ProjectsPage.tsx`** the same way: consume `useGroupDrafts` + shared components, delete the local duplicates. Preserve `ProjectsPage`'s own layout/classnames.

**Step 8 — Final checkpoint**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: no errors. Target: combined line count of the two pages drops materially (roughly ~1500 → ~700) with zero behavior change.

**Step 9 — Verification note for the user (no build now):** when next launched, exercise both surfaces — the Projects page and the quick panel on a non-projects route — for: create project/group, duplicate group, add/delete manual current, edit quantity, assign/remove material. Behavior must be identical to before.

---

## Done criteria

- `pnpm typecheck` passes across the monorepo.
- `pnpm --filter @elektroplan/storage test` passes, including the new cascade-delete test.
- `pnpm lint` clean.
- No deep `../../../../../../` imports remain (`grep -rn "packages/contracts/src" apps/desktop/renderer/src` returns nothing).
- Renderer delete mutations no longer loop record deletes; deletion is a single group delete relying on DB cascade.
- ProjectsPage and ProjectQuickPanel share one draft hook + presentational components.
