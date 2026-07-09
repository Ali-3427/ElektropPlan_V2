# contracts & exporters — Code Quality Findings (scan only)

> **Status: documentation only.** This is a scan report from `code-simplifier`, not an executed fix. No code in `packages/contracts` or `packages/exporters` has been changed as a result of this document (except deleting stray `dist-old/` build artifacts in both packages, done separately as routine cleanup, not a code fix). Fixes will be planned and executed in a later session, on a dedicated branch, one task at a time.

**Scope:** `packages/contracts/src` (shared zod schemas/types) and `packages/exporters/src` (Excel/PDF/JSON export). Both consumed by `apps/desktop/main` and depend on `calculation-core`/`storage` types.

---

## packages/contracts

### High

**F1 — `manualCurrentResponseSchema` drift** (`schemas.ts:602-606`). Every other calculation response uses `createCalculationResultSchema` (value + warnings + assumptions + formulaVariant + versions, `.strict()`). Manual-current is a bare `{ value: { currentA } }` — its records carry none of the metadata siblings guarantee. Also `currentA` here is a loose `z.number()`, while the *request* schema requires `z.number().finite().nonnegative()` (line 597) — so a manual-current **response** can contain `NaN`/`Infinity`/negative values that the matching request would reject.

### Medium

**F2 — Same-field strictness drift for `sectionMm2` / `lengthM` / power fields.** `voltageDropInputBaseSchema` (135-147) uses plain `z.number()` (allows 0/negative), but the group segment schema (204-235) uses `.positive()` for the identical physical quantities. One sibling is looser than the other for the same concept.

**F3 — Near-duplicate settings shapes.** `voltageDropGroupSettingsRequestSchema` (237-256), `...ResolvedSettingsSchema` (266-285), and the inline `settings` object inside `voltageDropGroupSegmentOutputSchema` (306-322) all repeat ~13 identical fields. Should derive from one shared base object instead of copy-pasting.

### Low

- **F4** — `motorPhaseSchema` (line 50) and `cablePhaseSchema` (line 362) are byte-identical (`z.union([literal(1), literal(3)])`). Collapse to one.
- **F5** — `conductorMaterialSchema = ampacityMaterialSchema` alias (line 7); both names used interchangeably for the same enum elsewhere, adds reader friction.

*(Note: there is no `contracts.ts` file — only `schemas.ts`, `project-marker.ts`, `index.ts`. The originally-suspected "contracts.ts vs schemas.ts" schema drift does not apply; `packages/storage/src/contracts.ts` is a separate, unrelated pass-through file, tracked in the storage findings doc instead.)*

---

## packages/exporters

### High

**F6 — PDF byte-length bug** (`pdf.ts:190`). The stream dict writes `/Length ${content.length}` using the JS string's UTF-16 code-unit count, but the file is actually emitted via `encodeUtf8` (byte count). Any non-ASCII character (Turkish `ğ`, `ş`, `ı` in titles/values) makes `/Length` wrong, producing a malformed PDF stream. Compounded by Helvetica + `escapePdfText` not encoding non-Latin1 characters at all — this is worth checking with a real Turkish-content export before treating it as theoretical.

**F7 — PDF vs Excel/JSON architecture inconsistency.** `excel.ts` and `json.ts` consume `CalculationsExport` directly, and Excel reuses `buildRecordSectionRows` from `shared.ts`. `pdf.ts` instead consumes a separately pre-flattened `PdfPresentationDocument`, sharing nothing with `shared.ts`'s flattening logic (`flattenValue`/`buildRecordSectionRows`, lines 92-281). Because that shared flattening is only used by Excel, PDF and Excel can silently diverge in what fields/rows they show for the same record.

### Low

- **F8** — Dead Excel "body" cell style (`excel.ts:138` + `WorksheetCell.styleId` type, line 19): defined and typed but never applied to any cell.
- **F9** — `inferCellType` dead/incorrect branches (`excel.ts:22-32`). All cells are currently built from strings, so the Number/Boolean paths never execute; if they ever did, the boolean branch emits `true`/`false`, which is invalid for SpreadsheetML `Boolean` cells (expects `1`/`0`).
- **F10** — `encodeUtf8` reinvents `TextEncoder` (`shared.ts:18-57`); the final 4-byte `else` branch (lines 50-53) is unreachable given the preceding `<= 0xffff` branch always returns first. Replace with `new TextEncoder().encode()`.

### Notes (not defects)

- No export format validates input or throws — this absence is *consistent* across all three formats, not an inconsistency to fix.
- No format rounds values; Excel/JSON emit raw float precision identically (no cross-format precision drift). Only worth revisiting if the PDF presentation-builder (in `apps/desktop`) rounds differently, which would create a PDF-vs-Excel mismatch — not confirmed, just flagged as a thing to check given F7.
- No dead exports: `exportCalculationResultToJson`, both JSON entry points, and `exportPresentationToPdf` are all consumed by `apps/desktop/main/src/services/export-service.ts`.

---

## Suggested order for the work phase (not started yet)

1. **F6** — verify with a real Turkish-content PDF export first (reproduce before fixing); if confirmed, this is a shipped correctness bug.
2. **F1** — decide whether manual-current should adopt the standard response envelope (breaking change to stored records) or just tighten `currentA` to match its request schema (non-breaking, smaller fix).
3. **F7** — larger structural change (share the flattening logic between PDF and Excel); do after F6/F1, with before/after export comparisons on a few real records.
4. **F2, F3, F4, F5, F8, F9, F10** — mechanical, low-risk cleanup, safe to batch.

**Verify commands:**
- `pnpm --filter @elektroplan/contracts typecheck`
- `pnpm --filter @elektroplan/contracts test`
- `pnpm --filter @elektroplan/exporters typecheck`
- `node packages/exporters/smoke.mjs` (existing smoke test — re-run after any exporter change, especially F6/F7, with a Turkish-character fixture)
