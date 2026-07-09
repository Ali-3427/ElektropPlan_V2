# storage — Code Quality Findings (scan only)

> **Status: documentation only.** This is a scan report from `code-simplifier`, not an executed fix. No code in `packages/storage` has been changed as a result of this document (except deleting the stray `dist-old/` build artifact, done separately as routine cleanup, not a code fix). Fixes will be planned and executed in a later session, on a dedicated branch, one task at a time.

**Scope:** `packages/storage/src` — SQLite-backed storage layer (`better-sqlite3`) for the Electron app: `repositories.ts`, `database.ts`, `migrations.ts`, `serialization.ts`, `contracts.ts`, `types.ts`. Consumed by `apps/desktop/main`.

---

## High impact

### F1 — Redundant pre-read on every write (all repos + settings)

Each `upsert`/`set` does a `getById` first *only* to preserve `created_at` (`repositories.ts:192-198, 353-359, 445-450, 605-611, 743-749, 822-830`). But every `ON CONFLICT ... DO UPDATE` already sets `created_at = <table>.created_at` at the SQL level, so the JS-side `created_at: current?.createdAt ?? row.created_at` is fully redundant. Every write currently costs 3 statements (read → run → read); dropping the pre-read removes one query per write across the whole package with no behavior change.

---

## Medium

### F2 — Migration 2 is effectively dead for fresh databases

`migrations.ts:70-88` — migration 1 already creates `records.grouping_quantity` (line 44), so on any new database migration 2's `ALTER TABLE` always throws "duplicate column" and is swallowed via fragile `error.message.includes(...)` string matching. Only meaningful for pre-existing DBs created before migration 1 included that column. Worth a comment explaining why, or a guard via `PRAGMA table_info` instead of catching-and-matching an error string.

### F3 — Statements re-prepared per call instead of cached

`MaterialsRepository.list` (`repositories.ts:569`) and `listForRecords` (`:712`) call `database.prepare(...)` on every invocation. Dynamic WHERE/IN-placeholder counts justify some of this, but the fixed-shape parts of the query could be memoized/cached.

### F4 — Material search runs in JS, not SQL

`repositories.ts:597-601` — all rows are loaded then filtered in memory via `matchesUnicodeSearch`. `idx_materials_name` is never used for search. Fine at small catalog sizes; a full-table load per search call is wasteful for a growing catalog.

---

## Low / consistency

- **F5** — Duplicated SELECT column lists: Records repeats its full column list 3× (`repositories.ts:218, 239, 261`), Groups 2×, Materials 2×, Assignments 2×. Extract a per-table column constant.
- **F6** — Inconsistent `getById` visibility: `MaterialAssignmentsRepository.getById` is `private` (`:759`) and absent from the interface, while every other repo exposes it publicly. `MaterialAssignmentsRepository` also has no public `getById`/list-all, unlike its siblings.
- **F7** — Double Zod validation per write: `serialize*` parses the input, then the trailing `getById` call's `deserialize*` re-parses the same data on the way back out.
- **F8** — `contracts.ts` is a pure pass-through re-export of `@elektroplan/contracts` — an indirection layer with no added value.
- **F9** — Style: `recordMigration`/`runWrapped` are arrow consts (`migrations.ts:261, 268`); project convention (per CLAUDE.md) prefers the `function` keyword.

---

## Correctness smells

### F10 — Category delete inconsistency

`materials.category_id` is `ON DELETE RESTRICT` (`migrations.ts:105`), so `materialCategories.delete()` **throws** on a referenced category, while every other repo's `delete()` returns a boolean (`true`/`false`) instead of throwing. Callers that expect a boolean will get an uncaught exception for this one case.

### F11 — Grouping collapse on all-empty grouping

`deserializeRecord` (`serialization.ts:162-177`) only reconstructs the `grouping` object if some field is non-null. A record whose grouping is legitimately all-empty (all fields genuinely absent) loses the `grouping` object entirely on read, which may not round-trip the same shape that was written.

### Note (not a defect)

No true race condition exists in the "sync API surface" — `better-sqlite3` is synchronous and single-threaded, so the read-run-read sequences in F1 are wasteful but not racy. Migration transaction handling and the migration-4 FK-pragma dance (`migrations.ts:146-234`) were checked and are correctly implemented: FK enforcement is toggled off outside the wrapping transaction, `foreign_key_check` runs before commit, and the pragma is restored in a `finally`.

---

## Suggested order for the work phase (not started yet)

1. **F1** — drop the redundant pre-read; mechanical, no behavior change, immediate win across every write path.
2. **F10** — decide whether `materialCategories.delete()` should catch-and-return-false to match its siblings, or whether callers should be updated to expect the throw (check current call sites first).
3. **F11** — needs a test that writes an all-empty grouping and reads it back before deciding the fix.
4. **F2, F5, F6, F8, F9** — low-risk cleanup, safe to batch.
5. **F3, F4** — only worth doing if the materials catalog is expected to grow large; otherwise low priority.

**Verify commands:**
- `pnpm --filter @elektroplan/storage typecheck`
- `pnpm --filter @elektroplan/storage test`
