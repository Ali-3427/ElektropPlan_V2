# apps/desktop main + preload — Code Quality Findings (scan only)

> **Status: documentation only.** This is a scan report from `code-simplifier`, not an executed fix. No code in `apps/desktop/main` or `apps/desktop/preload` has been changed as a result of this document. Fixes will be planned and executed in a later session, on a dedicated branch, one task at a time.

**Scope:** `apps/desktop/main/src` (`index.ts`, `ipc/channels.ts`, `ipc/register.ts`, `services/*`) and `apps/desktop/preload/src/index.ts` (contextBridge surface). This is the Electron backend: main talks to `calculation-core`/`storage`/`exporters` via `services/`, and exposes them to the renderer through `ipc/` + preload's `contextBridge`.

---

## High — correctness

### F1 — macOS lifecycle destroys services but IPC handlers keep the dead reference

`index.ts:126-132` — `window-all-closed` calls `closeServices()` (closes the SQLite connection) on **all** platforms, but on darwin the app process stays alive after all windows close. IPC handlers registered at `register.ts:224` closed over the original `services` object; `closeServices()` only nulls the *module-level* `services` reference. A subsequent `activate` (`index.ts:116-120`) reopens a window whose already-registered handlers still reference the **closed** database.

**Fix direction:** either guard `activate` to re-open services before creating the window, or only call `closeServices()` on `before-quit` (matching actual app lifetime) instead of `window-all-closed`.

### F2 — `resolveBundledEntry` doesn't decode percent-encoding

`index.ts:15-23` returns `new URL(...).pathname`, which keeps percent-encoding (`%20` for spaces) intact. Any install path containing spaces (e.g. `C:\Users\John Doe\...`) yields a broken path passed to `loadFile`.

**Fix direction:** use Node's `fileURLToPath` instead of manually reading `.pathname` / stripping slashes.

---

## Medium — consistency / maintainability

### F3 — Validation duplicated across IPC and service layers, inconsistently

Records/groups/settings validate in **both** `register.ts` and the service layer:
- `assertIdPayload` (`register.ts:104`) then `getRecord`/`deleteRecord` re-check id (`records-service.ts:68-70, 78-80`)
- `assertKeyPayload` (`register.ts:121`) then `assertKey` (`settings-service.ts:14`)
- `assertDuplicateGroupPayload` (`register.ts:155`) then `duplicateGroup` re-checks (`records-service.ts:92-97`)
- `assertGroupTotalCurrentPayload` (`register.ts:183`) then `runGroupCableSuggest` re-checks `Number.isFinite` (`calculate-service.ts:171`)
- `assertMaterialsImportPayload` (`register.ts:200`) overlaps `importExcelParamsSchema` (`materials-service.ts:24`)

Meanwhile the calc/materials handlers pass raw payload straight through and rely solely on the service's zod schema — so the codebase already has **two different validation boundaries in active use**, inconsistently applied. Since services already zod-validate everything, the `register.ts` `assert*` helpers are largely redundant for those paths.

**Fix direction:** pick one boundary (likely: services own validation; register.ts stays a thin dispatcher) and apply it uniformly.

### F4 — Channel map and envelope type hand-duplicated between main and preload

`IPC_CHANNELS` (`channels.ts:2`) and `CHANNELS` (`preload/index.ts:25`) are identical objects kept in sync only by convention/comments. `IpcEnvelope` is separately declared in both files (`channels.ts:47`, `preload/index.ts:17`). This is the highest-churn drift risk between the two packages — a channel rename in one file silently desyncs from the other with no compiler error (both are just string literals matching by luck).

**Fix direction:** share a single const/type from one module both packages import (e.g. re-export `channels.ts`'s definitions through a small shared contract, or have preload import from main's package if the build allows it).

### F5 — No Content-Security-Policy

`index.ts` sets solid navigation/window-open guards (lines 35-48, this is the F5/hardenWindow work from the earlier `2026-06-26` plan) but never installs a CSP via `session.defaultSession.webRequest.onHeadersReceived` (or a `<meta>` CSP in the renderer's `index.html`). Standard hardening recommendation for a shipped Electron app that wasn't in scope of the earlier hardening pass.

---

## Low

- **F6** — `excelImportHandles` leaks (`register.ts:229`): handles are only deleted on a *successful* import (line 476). A pick with no follow-up import (user cancels, or errors before commit) grows the map unbounded for the life of the process. The error message "expired, or invalid" (line 473) implies a TTL/expiry that doesn't actually exist in the code.
- **F7** — `value as never` cast (`register.ts:397`): `services.settings.setSetting(key, value as never)` defeats typing; `setSetting` expects `JsonValue`.
- **F8** — `assertOptionalGroupId` hardcodes another channel's name in its error message (`register.ts:101`, throws `"records:list payload…"`) even though the helper itself is generic and reused elsewhere.
- **F9** — `AppServices.storage` is exposed (`index.ts:36` / `services/index.ts:57`) but never consumed by any IPC handler — dead surface, unlike the rest of `AppServices` which is fully wired.

## Note (not a defect)

No dead IPC channels: everything in `channels.ts` is handled, and every bridge method in preload is wired to a handler. No unhandled promise rejections in the IPC layer either — `wrap` (`register.ts:26`) uniformly catches and envelopes errors, and both the seed promise (`index.ts:105`) and `whenReady` (`index.ts:121`) have `.catch`.

---

## Suggested order for the work phase (not started yet)

1. **F1** — lifecycle/closed-DB bug; verify repro on macOS (or via forcing `window-all-closed` + `activate` in a test) before fixing, since it's platform-specific and easy to "fix" without actually reproducing it first.
2. **F2** — percent-encoding path bug; quick to fix, quick to verify (install/run from a path with a space).
3. **F3** — needs a decision on which validation boundary is canonical before touching call sites across 5+ handlers.
4. **F4** — do after F3, since consolidating channels/envelope types touches the same files as the validation cleanup.
5. **F5** — CSP addition, independent of the above, can be done anytime.
6. **F6, F7, F8, F9** — mechanical, low-risk, safe to batch.

**Verify commands:**
- `cd apps/desktop/main && npx tsc --noEmit`
- `cd apps/desktop/preload && npx tsc --noEmit`
- `pnpm --filter @elektroplan/desktop-main test` (materials-service.test.ts, records-service.test.ts)
- Manual smoke for F1/F2: package a build, install to a path containing a space, and (on macOS only) close all windows then reopen via dock icon.
