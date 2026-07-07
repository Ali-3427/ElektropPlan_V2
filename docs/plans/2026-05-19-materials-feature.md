# Materials Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a centralized materials catalog (Malzemeler) with categorized CRUD, Excel import/merge, and per-record material assignments visible in the Quick Panel.

**Architecture:** Mirror the existing layered stack — extend `contracts` with material schemas, add a build-time seed JSON in `calculation-data`, introduce migration `p3` plus three SQLite repositories in `storage`, expose new IPC channels via `main`/`preload`, add a `/materials` route with a CategoryTree+Table page in the renderer, and wire assignment popovers + chips into the existing `ProjectQuickPanel`. Assignments are snapshotted (catalog edits don't mutate past assignments) but keep a nullable FK to the catalog material for re-link.

**Tech Stack:** TypeScript, pnpm workspaces + Turborepo, Zod, React + react-router-dom + TanStack Query, Electron (main/preload/renderer), better-sqlite3, Vitest, Node `xlsx` for parsing the seed.

**Companion design:** [`2026-05-19-materials-feature-design.md`](2026-05-19-materials-feature-design.md)

---

## Conventions

- Every task ends with `git add … && git commit -m …`. Conventional Commits.
- Run `pnpm -w turbo run typecheck` and `pnpm -w turbo run test` from repo root unless a tighter command is given.
- Path separators in this plan: forward slashes; on Windows PowerShell they still work.
- New text strings in the UI: Turkish (matches existing pages).
- Do not introduce new top-level packages. Reuse `packages/contracts`, `packages/calculation-data`, `packages/storage`.
- Snapshot pattern: when an assignment row is written, copy `name`, `categoryId`, `categoryTitle`, `brand`, `modelCode`, `unitPrice`, `attributes` from the catalog material into the assignment row.

---

## Task 1: Material Zod schemas in contracts

**Files:**
- Modify: `packages/contracts/src/schemas.ts` (append at end of file)
- Modify: `packages/contracts/src/index.ts` (re-exports)
- Test: `packages/contracts/src/schema.test.ts` (append new describe block)

**Step 1: Write failing test**

Append to `packages/contracts/src/schema.test.ts`:

```ts
import {
  materialCategorySchema,
  materialSchema,
  materialAssignmentSchema,
  materialUnitSchema,
} from "./schemas.js";

describe("materials schemas", () => {
  it("parses a minimal material category", () => {
    const result = materialCategorySchema.parse({
      id: "kontaktorler",
      title: "KONTAKTÖRLER",
    });
    expect(result.id).toBe("kontaktorler");
  });

  it("parses a material with full optional fields", () => {
    const result = materialSchema.parse({
      id: "kontaktorler--af38",
      categoryId: "kontaktorler",
      name: "AF38",
      orderValue: 1,
      brand: "ABB",
      modelCode: "AF38-30-00-13",
      unit: "adet",
      unitPrice: 1450.5,
      stockQty: 0,
      notes: "",
      attributes: { coilV: 230 },
      source: "seed",
      seedDataVersion: "materials-2026-05-19",
    });
    expect(result.source).toBe("seed");
  });

  it("rejects negative unit price", () => {
    expect(() =>
      materialSchema.parse({
        id: "x",
        categoryId: "c",
        name: "n",
        unitPrice: -1,
        source: "user",
      }),
    ).toThrow();
  });

  it("parses an assignment with snapshot fields", () => {
    const result = materialAssignmentSchema.parse({
      id: "asg_1",
      recordId: "rec_1",
      materialId: "kontaktorler--af38",
      quantity: 2,
      unit: "adet",
      snapshotName: "AF38",
      snapshotCategoryId: "kontaktorler",
      snapshotCategoryTitle: "KONTAKTÖRLER",
    });
    expect(result.quantity).toBe(2);
  });

  it("allows null materialId on assignment (orphaned snapshot)", () => {
    const result = materialAssignmentSchema.parse({
      id: "asg_2",
      recordId: "rec_1",
      materialId: null,
      quantity: 1,
      snapshotName: "Custom item",
      snapshotCategoryId: "custom",
      snapshotCategoryTitle: "Özel",
    });
    expect(result.materialId).toBeNull();
  });

  it("rejects unit outside enum", () => {
    expect(() => materialUnitSchema.parse("foo")).toThrow();
  });
});
```

**Step 2: Run, expect FAIL**

Run: `pnpm --filter @elektroplan/contracts test`
Expected: failures — schemas do not exist.

**Step 3: Implement schemas**

Append to `packages/contracts/src/schemas.ts`:

```ts
export const materialUnitSchema = z.enum(["adet", "m", "kg", "set", "paket"]);

export const materialCategorySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    orderValue: z.number().int().optional(),
    iconKey: z.string().optional(),
  })
  .strict();

export const materialSchema = z
  .object({
    id: z.string().min(1),
    categoryId: z.string().min(1),
    name: z.string().min(1),
    orderValue: z.number().int().optional(),
    brand: z.string().optional(),
    modelCode: z.string().optional(),
    unit: materialUnitSchema.optional(),
    unitPrice: z.number().nonnegative().optional(),
    stockQty: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    attributes: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional(),
    source: z.enum(["seed", "user"]).default("user"),
    seedDataVersion: z.string().optional(),
  })
  .strict();

export const materialAssignmentSchema = z
  .object({
    id: z.string().min(1),
    recordId: z.string().min(1),
    materialId: z.string().nullable(),
    quantity: z.number().positive(),
    unit: materialUnitSchema.optional(),
    snapshotName: z.string().min(1),
    snapshotCategoryId: z.string().min(1),
    snapshotCategoryTitle: z.string().min(1),
    snapshotBrand: z.string().optional(),
    snapshotModelCode: z.string().optional(),
    snapshotUnitPrice: z.number().nonnegative().optional(),
    snapshotAttributes: z.record(z.string(), z.unknown()).optional(),
    orderValue: z.number().int().optional(),
  })
  .strict();

export type MaterialUnit = z.infer<typeof materialUnitSchema>;
export type MaterialCategory = z.infer<typeof materialCategorySchema>;
export type Material = z.infer<typeof materialSchema>;
export type MaterialAssignment = z.infer<typeof materialAssignmentSchema>;
```

Also extend `calculationsExportSchema`:

```ts
// Replace the existing calculationsExportSchema with:
export const calculationsExportSchema = z
  .object({
    version: recordVersionSchema,
    exportedAt: z.string(),
    groups: z.array(calculationGroupSchema),
    records: z.array(calculationRecordSchema),
    materialCategories: z.array(materialCategorySchema).optional(),
    materials: z.array(materialSchema).optional(),
    materialAssignments: z.array(materialAssignmentSchema).optional(),
  })
  .strict();
```

Then update `packages/contracts/src/index.ts` to re-export the new symbols.

**Step 4: Run, expect PASS**

Run: `pnpm --filter @elektroplan/contracts test`
Expected: all material tests green; existing tests still green.

**Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add material/category/assignment schemas"
```

---

## Task 2: Seed pipeline — Excel parser script

**Files:**
- Create: `packages/calculation-data/scripts/build-materials-seed.mjs`
- Modify: `packages/calculation-data/package.json` — add `xlsx` to `devDependencies` and a `build:materials` script
- Create: `packages/calculation-data/tests/build-materials-seed.test.ts`

**Step 1: Add dependency**

```bash
pnpm --filter @elektroplan/calculation-data add -D xlsx
```

**Step 2: Write the test (uses the parser as a pure function)**

Create `packages/calculation-data/tests/build-materials-seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMaterialsWorkbook } from "../scripts/build-materials-seed.mjs";

describe("parseMaterialsWorkbook", () => {
  it("groups rows into categories and produces deterministic ids", () => {
    const rows = [
      ["MST MALZEME LİSTESİ", null, null],
      ["KATEGORİ", "SIRA NO", "MALZEME ADI"],
      ["KAÇAK AKIM KORUMA RÖLELERİ", null, null],
      [null, 1, "KAKR 40A 30mA"],
      [null, 2, "KAKR 25A 30mA FAZ+NÖTR"],
      ["OTOMATİK SİGORTALAR - C TİPİ", null, null],
      [null, 1, "C80 3x80A"],
    ];

    const result = parseMaterialsWorkbook(rows, {
      dataVersion: "materials-test",
    });

    expect(result.categories).toHaveLength(2);
    expect(result.categories[0]).toMatchObject({
      id: "kacak-akim-koruma-roleleri",
      title: "KAÇAK AKIM KORUMA RÖLELERİ",
    });
    expect(result.materials).toHaveLength(3);
    expect(result.materials[0]).toMatchObject({
      id: "kacak-akim-koruma-roleleri--kakr-40a-30ma",
      categoryId: "kacak-akim-koruma-roleleri",
      name: "KAKR 40A 30mA",
      orderValue: 1,
      source: "seed",
      seedDataVersion: "materials-test",
    });
  });

  it("is deterministic across runs", () => {
    const rows = [
      ["X", null, null],
      [null, 1, "Item"],
    ];
    const a = parseMaterialsWorkbook(rows, { dataVersion: "v" });
    const b = parseMaterialsWorkbook(rows, { dataVersion: "v" });
    expect(a).toEqual(b);
  });
});
```

**Step 3: Run, expect FAIL**

Run: `pnpm --filter @elektroplan/calculation-data test`
Expected: module not found.

**Step 4: Implement parser script**

Create `packages/calculation-data/scripts/build-materials-seed.mjs`:

```js
#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const DEFAULT_INPUT = resolve(REPO_ROOT, "docs", "MST malzeme listesi.xlsx");
const DEFAULT_OUTPUT = resolve(
  PACKAGE_ROOT,
  "src",
  "datasets",
  "materials.json",
);

const TURKISH_MAP = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

export function slugify(input) {
  const lowered = String(input)
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("")
    .toLowerCase();
  return lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SKIP_FIRST_ROWS = new Set(["MST MALZEME LİSTESİ", "KATEGORİ"]);

export function parseMaterialsWorkbook(rows, options) {
  const dataVersion = options?.dataVersion ?? "materials-unversioned";
  const categories = [];
  const materials = [];
  let activeCategory = null;
  let categoryOrder = 0;

  for (const row of rows) {
    const a = (row?.[0] ?? "").toString().trim();
    const b = row?.[1];
    const c = (row?.[2] ?? "").toString().trim();

    if (a && SKIP_FIRST_ROWS.has(a)) continue;
    if (a && !c) {
      const id = slugify(a);
      activeCategory = id;
      categoryOrder += 1;
      categories.push({ id, title: a, orderValue: categoryOrder });
      continue;
    }
    if (!a && c && activeCategory) {
      const id = `${activeCategory}--${slugify(c)}`;
      const orderValue =
        typeof b === "number" ? Math.trunc(b) : Number.parseInt(String(b ?? ""), 10);
      materials.push({
        id,
        categoryId: activeCategory,
        name: c,
        orderValue: Number.isFinite(orderValue) ? orderValue : undefined,
        source: "seed",
        seedDataVersion: dataVersion,
      });
    }
  }

  return { categories, materials, dataVersion };
}

export function readWorkbookRows(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

async function main() {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;
  const outputPath = process.argv[3] ?? DEFAULT_OUTPUT;
  const dataVersion = `materials-${new Date().toISOString().slice(0, 10)}`;
  const rows = readWorkbookRows(inputPath);
  const result = parseMaterialsWorkbook(rows, { dataVersion });
  const payload = {
    metadata: {
      id: "materials",
      standard: "internal",
      revision: dataVersion,
      source: inputPath,
      validFrom: new Date().toISOString(),
      notes: "Generated from Excel by build-materials-seed.mjs",
    },
    categories: result.categories,
    materials: result.materials,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${result.categories.length} categories, ${result.materials.length} materials → ${outputPath}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

Add the script in `packages/calculation-data/package.json`:

```json
"scripts": {
  "build:materials": "node scripts/build-materials-seed.mjs"
}
```

**Step 5: Run tests, expect PASS**

Run: `pnpm --filter @elektroplan/calculation-data test`

**Step 6: Run the seed builder against the real Excel**

Run: `pnpm --filter @elektroplan/calculation-data build:materials`
Expected output: `Wrote 40 categories, ~280 materials → …/datasets/materials.json`. Open the file and sanity-check first 5 categories and a few rows.

**Step 7: Commit**

```bash
git add packages/calculation-data
git commit -m "feat(calculation-data): add materials seed parser and dataset"
```

---

## Task 3: Materials accessor in calculation-data

**Files:**
- Create: `packages/calculation-data/src/dataset/materials.ts`
- Modify: `packages/calculation-data/src/index.ts`
- Test: `packages/calculation-data/tests/materials-dataset.test.ts`

**Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { getMaterialSeed } from "../src/dataset/materials.js";

describe("getMaterialSeed", () => {
  it("returns categories and materials with non-empty arrays", () => {
    const seed = getMaterialSeed();
    expect(seed.categories.length).toBeGreaterThan(10);
    expect(seed.materials.length).toBeGreaterThan(50);
    expect(seed.dataVersion).toMatch(/^materials-/);
  });

  it("every material references an existing category", () => {
    const seed = getMaterialSeed();
    const ids = new Set(seed.categories.map((c) => c.id));
    for (const m of seed.materials) {
      expect(ids.has(m.categoryId)).toBe(true);
    }
  });
});
```

**Step 2: Run, expect FAIL**

**Step 3: Implementation**

```ts
// packages/calculation-data/src/dataset/materials.ts
import payload from "./materials.json" with { type: "json" };
import type { Material, MaterialCategory } from "@elektroplan/contracts";

export interface MaterialSeed {
  readonly dataVersion: string;
  readonly categories: readonly MaterialCategory[];
  readonly materials: readonly Material[];
}

export function getMaterialSeed(): MaterialSeed {
  return {
    dataVersion: payload.metadata.revision,
    categories: payload.categories as MaterialCategory[],
    materials: payload.materials as Material[],
  };
}
```

If the package uses `with { type: "json" }` import assertions in other files, follow that. Otherwise use `node:fs` to read the JSON at runtime. Match the package's existing pattern (check `packages/calculation-data/src/dataset/index.ts` for prior art and copy it).

Re-export from `packages/calculation-data/src/index.ts`:

```ts
export { getMaterialSeed } from "./dataset/materials.js";
export type { MaterialSeed } from "./dataset/materials.js";
```

**Step 4: PASS**, then commit:

```bash
git add packages/calculation-data
git commit -m "feat(calculation-data): expose getMaterialSeed accessor"
```

---

## Task 4: Storage migration `p3_materials_schema`

**Files:**
- Modify: `packages/storage/src/migrations.ts`
- Test: `packages/storage/src/index.test.ts` (append)

**Step 1: Test**

Append to `packages/storage/src/index.test.ts`:

```ts
it("p3 creates materials, material_categories and material_assignments tables", () => {
  const db = createDatabase();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
    .all()
    .map((row: { name: string }) => row.name);
  expect(tables).toEqual(
    expect.arrayContaining([
      "material_categories",
      "materials",
      "material_assignments",
    ]),
  );
});

it("p3 enforces CASCADE delete from records to material_assignments", () => {
  const db = createDatabase();
  // Insert a record + assignment, then delete record, expect assignment gone.
  // Use raw SQL — repos come in next task.
  db.prepare(
    "INSERT INTO records (id, calculator, input_json, output_json, version_contract, created_at, updated_at) VALUES (?, 'motor', '{}', '{}', '1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
  ).run("rec_x");
  db.prepare(
    "INSERT INTO material_categories (id, title, order_value, icon_key, created_at, updated_at) VALUES ('cat1','Cat',1,NULL,'t','t')",
  ).run();
  db.prepare(
    "INSERT INTO materials (id, category_id, name, source, created_at, updated_at) VALUES ('m1','cat1','M','user','t','t')",
  ).run();
  db.prepare(
    "INSERT INTO material_assignments (id, record_id, material_id, quantity, snapshot_name, snapshot_category_id, snapshot_category_title, created_at, updated_at) VALUES ('a1','rec_x','m1',1,'M','cat1','Cat','t','t')",
  ).run();
  db.prepare("DELETE FROM records WHERE id = ?").run("rec_x");
  const remaining = db
    .prepare("SELECT COUNT(*) as n FROM material_assignments")
    .get() as { n: number };
  expect(remaining.n).toBe(0);
});
```

If `createDatabase` does not exist in the test file, look at the existing test setup and mirror it (`openStorageDatabase` with an in-memory `":memory:"` path).

**Step 2: Run, expect FAIL**

Run: `pnpm --filter @elektroplan/storage test`

**Step 3: Add migration**

Append to the `migrations` array in `packages/storage/src/migrations.ts`:

```ts
{
  id: 3,
  name: "p3_materials_schema",
  up(database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS material_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        order_value INTEGER NULL,
        icon_key TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES material_categories(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        order_value INTEGER NULL,
        brand TEXT NULL,
        model_code TEXT NULL,
        unit TEXT NULL,
        unit_price REAL NULL,
        stock_qty INTEGER NULL,
        notes TEXT NULL,
        attributes_json TEXT NULL,
        source TEXT NOT NULL DEFAULT 'user',
        seed_data_version TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS material_assignments (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        material_id TEXT NULL REFERENCES materials(id) ON DELETE SET NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT NULL,
        snapshot_name TEXT NOT NULL,
        snapshot_category_id TEXT NOT NULL,
        snapshot_category_title TEXT NOT NULL,
        snapshot_brand TEXT NULL,
        snapshot_model_code TEXT NULL,
        snapshot_unit_price REAL NULL,
        snapshot_attributes_json TEXT NULL,
        order_value INTEGER NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
      CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
      CREATE INDEX IF NOT EXISTS idx_assignments_record ON material_assignments(record_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_material ON material_assignments(material_id);
    `);
  },
},
```

**Step 4: PASS**, commit:

```bash
git add packages/storage
git commit -m "feat(storage): add p3 materials schema with cascade on records"
```

---

## Task 5: MaterialCategoriesRepository

**Files:**
- Modify: `packages/storage/src/types.ts` (add interface + persisted type)
- Modify: `packages/storage/src/repositories.ts` (add `SqliteMaterialCategoriesRepository`, wire into `SqliteStorageRepositories`)
- Modify: `packages/storage/src/contracts.ts` (re-export new types if needed)
- Test: `packages/storage/src/material-repos.test.ts` (new file)

**Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { openStorageDatabase } from "./index.js";
import BetterSqlite3 from "better-sqlite3";

function open() {
  return openStorageDatabase({ filename: ":memory:", sqlite: BetterSqlite3 });
}

describe("material categories repository", () => {
  it("upserts and lists categories ordered by orderValue then title", () => {
    const db = open();
    const repo = db.repositories.materialCategories;
    repo.upsert({ id: "b", title: "B", orderValue: 2 });
    repo.upsert({ id: "a", title: "A", orderValue: 1 });
    expect(repo.list().map((c) => c.id)).toEqual(["a", "b"]);
    db.close();
  });

  it("deletes a category", () => {
    const db = open();
    const repo = db.repositories.materialCategories;
    repo.upsert({ id: "x", title: "X" });
    expect(repo.delete("x")).toBe(true);
    expect(repo.list()).toHaveLength(0);
    db.close();
  });

  it("delete returns false when category is missing", () => {
    const db = open();
    expect(db.repositories.materialCategories.delete("missing")).toBe(false);
    db.close();
  });
});
```

**Step 2: Run, expect FAIL**

**Step 3: Implementation**

Mirror `SqliteGroupsRepository` style: `prepare` statements in the constructor, `upsert` uses `INSERT … ON CONFLICT(id) DO UPDATE`. Expose `materialCategories: MaterialCategoriesRepository` on `StorageRepositories` and assign in `SqliteStorageRepositories`.

Read `packages/storage/src/repositories.ts:24-200` for the existing pattern and follow it exactly. Add typed `MaterialCategoryRow` interface in `serialization.ts` plus `serializeMaterialCategory` / `deserializeMaterialCategory` helpers.

**Step 4: PASS**, commit:

```bash
git add packages/storage
git commit -m "feat(storage): add material categories repository"
```

---

## Task 6: MaterialsRepository

**Files:**
- Modify: `packages/storage/src/types.ts`, `repositories.ts`, `serialization.ts`
- Test: `packages/storage/src/material-repos.test.ts` (append)

**Step 1: Tests**

```ts
describe("materials repository", () => {
  it("upserts a material and lists by category", () => {
    const db = open();
    db.repositories.materialCategories.upsert({ id: "c1", title: "Cat 1" });
    db.repositories.materials.upsert({
      id: "c1--m1",
      categoryId: "c1",
      name: "M1",
      source: "user",
    });
    db.repositories.materials.upsert({
      id: "c1--m2",
      categoryId: "c1",
      name: "M2",
      source: "user",
    });
    const list = db.repositories.materials.list({ categoryId: "c1" });
    expect(list).toHaveLength(2);
    db.close();
  });

  it("search filters case-insensitively across name, brand, model", () => {
    const db = open();
    db.repositories.materialCategories.upsert({ id: "c1", title: "Cat 1" });
    db.repositories.materials.upsert({
      id: "c1--abb-af38",
      categoryId: "c1",
      name: "AF38",
      brand: "ABB",
      source: "user",
    });
    const results = db.repositories.materials.list({ search: "abb" });
    expect(results.map((m) => m.id)).toEqual(["c1--abb-af38"]);
    db.close();
  });

  it("deleting a category with materials throws (RESTRICT)", () => {
    const db = open();
    db.repositories.materialCategories.upsert({ id: "c1", title: "Cat 1" });
    db.repositories.materials.upsert({
      id: "c1--m1",
      categoryId: "c1",
      name: "M1",
      source: "user",
    });
    expect(() => db.repositories.materialCategories.delete("c1")).toThrow();
    db.close();
  });
});
```

**Step 2: FAIL → Step 3: implement**

Pattern identical to records repository. Note the `attributes_json` column round-trips `attributes` via `JSON.stringify` / `JSON.parse`. `list(options?)` supports `categoryId`, `search`, and `source`.

**Step 4: PASS → Step 5: Commit**

```bash
git add packages/storage
git commit -m "feat(storage): add materials repository with search and category filter"
```

---

## Task 7: MaterialAssignmentsRepository

**Files:**
- Modify: same trio
- Test: `packages/storage/src/material-repos.test.ts` (append)

**Step 1: Tests**

```ts
describe("material assignments repository", () => {
  function seedRecord(db: ReturnType<typeof open>, id: string) {
    const sqlite = (db as any).repositories.records as RecordsRepository;
    // Easiest: insert a minimal motor record via the public API:
    sqlite.upsert({
      id,
      calculator: "motor",
      version: { contractVersion: "1.0.0" },
      input: { mode: "table", kW: 1, voltage: 380 },
      output: {
        value: {
          mode: "table",
          kW: 1,
          PS: 1.34,
          cosPhi: 0.86,
          efficiencyPercent: 87,
          currentA: 2.5,
          cableSpec: "1.5",
        },
        warnings: [],
        assumptions: [],
        formulaVariant: "test",
        dataVersion: "test",
        engineVersion: "test",
      },
    });
  }

  it("upserts an assignment and lists by record id", () => {
    const db = open();
    db.repositories.materialCategories.upsert({ id: "c1", title: "Cat 1" });
    db.repositories.materials.upsert({
      id: "c1--m1",
      categoryId: "c1",
      name: "M1",
      source: "user",
    });
    seedRecord(db, "rec_1");
    db.repositories.assignments.upsert({
      id: "a1",
      recordId: "rec_1",
      materialId: "c1--m1",
      quantity: 2,
      snapshotName: "M1",
      snapshotCategoryId: "c1",
      snapshotCategoryTitle: "Cat 1",
    });
    expect(
      db.repositories.assignments.listForRecords(["rec_1"]).map((a) => a.id),
    ).toEqual(["a1"]);
    db.close();
  });

  it("deleting a material nulls assignment.material_id but keeps snapshot", () => {
    const db = open();
    /* seed cat/material/record/assignment as above */
    db.repositories.materials.delete("c1--m1");
    const [asg] = db.repositories.assignments.listForRecords(["rec_1"]);
    expect(asg.materialId).toBeNull();
    expect(asg.snapshotName).toBe("M1");
    db.close();
  });
});
```

**Step 2-4: FAIL → implement → PASS**

Implementation: `listForRecords(recordIds: string[])` builds `WHERE record_id IN (?, ?, …)`. `upsert` writes all 14 snapshot columns. `delete(id): boolean`.

**Step 5: Commit**

```bash
git add packages/storage
git commit -m "feat(storage): add material assignments repository with snapshot fields"
```

---

## Task 8: Extend export snapshot

**Files:**
- Modify: `packages/storage/src/repositories.ts` → `SqliteStorageRepositories.exportSnapshot`
- Test: append to `packages/storage/src/index.test.ts`

**Step 1: Test**

```ts
it("exportSnapshot includes materials and assignments", () => {
  const db = open();
  db.repositories.materialCategories.upsert({ id: "c1", title: "C1" });
  db.repositories.materials.upsert({
    id: "c1--m1",
    categoryId: "c1",
    name: "M1",
    source: "user",
  });
  const snapshot = db.repositories.exportSnapshot({ contractVersion: "1.0.0" });
  expect(snapshot.materialCategories).toHaveLength(1);
  expect(snapshot.materials).toHaveLength(1);
  expect(snapshot.materialAssignments).toEqual([]);
  db.close();
});
```

**Step 2-4: FAIL → implement → PASS**

`exportSnapshot` returns an object that passes `calculationsExportSchema.parse(...)` with the new arrays included.

**Step 5: Commit**

```bash
git add packages/storage
git commit -m "feat(storage): include materials in export snapshot"
```

---

## Task 9: Main service `materials-service.ts`

**Files:**
- Create: `apps/desktop/main/src/services/materials-service.ts`
- Test: `apps/desktop/main/src/services/materials-service.test.ts`

**Step 1: Test**

```ts
import { describe, expect, it, beforeEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { openStorageDatabase } from "@elektroplan/storage";
import { createMaterialsService } from "./materials-service.js";

function newService() {
  const db = openStorageDatabase({ filename: ":memory:", sqlite: BetterSqlite3 });
  return { db, service: createMaterialsService(db.repositories) };
}

describe("materials service", () => {
  it("seedIfEmpty loads the calculation-data seed when materials table is empty", async () => {
    const { db, service } = newService();
    const result = await service.seedIfEmpty();
    expect(result.seeded).toBe(true);
    expect(db.repositories.materials.list({}).length).toBeGreaterThan(50);
    // Running again is a no-op
    const second = await service.seedIfEmpty();
    expect(second.seeded).toBe(false);
    db.close();
  });

  it("importExcel merges without touching user rows", async () => {
    const { db, service } = newService();
    await service.seedIfEmpty();
    db.repositories.materials.upsert({
      id: "custom--my-thing",
      categoryId: db.repositories.materialCategories.list()[0].id,
      name: "My custom",
      source: "user",
    });
    // Use the real Excel file from docs/.
    const summary = await service.importExcel({
      filePath: pathToFixtureXlsx,
      mode: "merge",
    });
    expect(summary.materialsAdded + summary.materialsUpdated).toBeGreaterThan(0);
    expect(
      db.repositories.materials.list({}).some((m) => m.id === "custom--my-thing"),
    ).toBe(true);
    db.close();
  });
});
```

(Optional: skip the `importExcel` test if reaching the Excel file is awkward; instead pass an injected `parseWorkbook` for unit isolation. The integration form is preferred.)

**Step 2-4: FAIL → implement → PASS**

Create the service:

```ts
import { readFileSync } from "node:fs";
import { getMaterialSeed } from "@elektroplan/calculation-data";
import { parseMaterialsWorkbook, readWorkbookRows } from
  "@elektroplan/calculation-data/scripts/build-materials-seed.mjs";
import type { StorageRepositories } from "@elektroplan/storage";
import type { Material, MaterialAssignment, MaterialCategory } from "@elektroplan/contracts";

export interface ImportSummary {
  categoriesAdded: number;
  materialsAdded: number;
  materialsUpdated: number;
  untouched: number;
}

export function createMaterialsService(repos: StorageRepositories) {
  return {
    seedIfEmpty,
    listCategories,
    upsertCategory,
    deleteCategory,
    listMaterials,
    upsertMaterial,
    deleteMaterial,
    listAssignments,
    upsertAssignment,
    deleteAssignment,
    importExcel,
  };

  async function seedIfEmpty() { /* … */ }
  async function importExcel(params: { filePath: string; mode: "merge" }): Promise<ImportSummary> { /* … */ }
  /* … rest are thin wrappers around repos */
}
```

Notes:
- `seedIfEmpty` calls `getMaterialSeed()` and writes categories first, then materials, in a single transaction.
- `importExcel` reads workbook rows and feeds them through `parseMaterialsWorkbook` (the same parser used by the build script — reuse, do not duplicate).
- `merge`: categories upsert; materials upsert by id; materials in DB with `source='user'` and materials with `source='seed'` not present in the import are **untouched**. Increment counters.
- Validate the final assignment object using `materialAssignmentSchema` before passing to the repo.

If importing scripts/build-materials-seed.mjs from TypeScript is awkward at runtime, extract the parser to `packages/calculation-data/src/dataset/materials-parser.ts` (TS) and have the script re-export it. Either path is fine — prefer TS source of truth.

**Step 5: Commit**

```bash
git add apps/desktop/main packages/calculation-data
git commit -m "feat(main): materials service with seed and Excel merge import"
```

---

## Task 10: IPC channels + handlers

**Files:**
- Modify: `apps/desktop/main/src/ipc/channels.ts` (add channel constants)
- Modify: `apps/desktop/main/src/ipc/register.ts` (register handlers)
- Modify: `apps/desktop/main/src/index.ts` (call `seedIfEmpty` on boot after DB open)
- Modify: `apps/desktop/preload/src/index.ts` (add `materials` and `assignments` namespaces to `ElektroPlanBridge`)
- Modify: `apps/desktop/renderer/src/bridge/types.ts` and `bridge/client.ts`

**Step 1: Test (preload contract)**

```ts
// packages/contracts already covers payload validation.
// Add a smoke test in apps/desktop/main:
it("materials.list IPC returns an array", async () => {
  // boot a service, register IPC on a fake ipcMain, call invoke, expect ok envelope.
});
```

If the existing repo uses an in-process IPC harness (`apps/desktop/main/src/services/records-service.test.ts` for example), follow that pattern. If there is no harness, skip the IPC unit test and rely on the renderer integration test in Task 18.

**Step 2-4: Implementation**

Channel names:

```ts
MaterialsListCategories: "materials:list-categories",
MaterialsUpsertCategory: "materials:upsert-category",
MaterialsDeleteCategory: "materials:delete-category",
MaterialsList: "materials:list",
MaterialsUpsert: "materials:upsert",
MaterialsDelete: "materials:delete",
MaterialsImportExcel: "materials:import-excel",
AssignmentsListForRecords: "assignments:list-for-records",
AssignmentsUpsert: "assignments:upsert",
AssignmentsDelete: "assignments:delete",
```

Handlers all use the existing IpcEnvelope pattern (search `register.ts` for `RecordsList` to copy). Each handler validates payload via the corresponding zod schema and returns either the validated zod-parsed value or throws (which `register.ts` already wraps in `{ ok: false, error }`).

In `apps/desktop/main/src/index.ts`, after opening the storage DB and before registering IPC, call `await materialsService.seedIfEmpty()`. Log the result. Do **not** crash if seed fails — log and continue.

Preload: extend `bridge.materials` and `bridge.assignments`:

```ts
materials: {
  listCategories: () => invoke(CHANNELS.MaterialsListCategories),
  upsertCategory: (input) => invoke(CHANNELS.MaterialsUpsertCategory, input),
  deleteCategory: (id) => invoke(CHANNELS.MaterialsDeleteCategory, id),
  list: (filter) => invoke(CHANNELS.MaterialsList, filter ?? {}),
  upsert: (input) => invoke(CHANNELS.MaterialsUpsert, input),
  delete: (id) => invoke(CHANNELS.MaterialsDelete, id),
  importExcel: (filePath, mode = "merge") =>
    invoke(CHANNELS.MaterialsImportExcel, { filePath, mode }),
},
assignments: {
  listForRecords: (recordIds) =>
    invoke(CHANNELS.AssignmentsListForRecords, { recordIds }),
  upsert: (input) => invoke(CHANNELS.AssignmentsUpsert, input),
  delete: (id) => invoke(CHANNELS.AssignmentsDelete, id),
},
```

Type the bridge sections in `ElektroPlanBridge`. Mirror those types in `apps/desktop/renderer/src/bridge/types.ts` and add wrapper methods in `bridge/client.ts` if that file is the indirection layer used by features.

**Step 5: Commit**

```bash
git add apps/desktop/main apps/desktop/preload apps/desktop/renderer/src/bridge
git commit -m "feat(ipc): materials and assignments channels with boot seed"
```

---

## Task 11: Router + Sidebar entry

**Files:**
- Modify: `apps/desktop/renderer/src/router.tsx`
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx`

**Step 1-3:**

In `router.tsx` import a new `MaterialsPage` and add a route:

```tsx
<Route path="/materials" element={<MaterialsPage />} />
```

In `Layout.tsx` `NAV` array insert between Projeler and Ayarlar:

```ts
{ to: "/materials", label: "Malzemeler" },
```

Build a placeholder `MaterialsPage`:

```tsx
// apps/desktop/renderer/src/features/materials/MaterialsPage.tsx
export function MaterialsPage() {
  return <div>Malzemeler — coming up</div>;
}
```

**Step 4: Smoke check**

Run: `pnpm --filter @elektroplan/renderer dev` (or the desktop app via `pnpm --filter @elektroplan/desktop dev`), click the sidebar entry, see the placeholder.

**Step 5: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(renderer): add /materials route and sidebar entry"
```

---

## Task 12: Data hooks `useMaterialsData`

**Files:**
- Create: `apps/desktop/renderer/src/features/materials/useMaterialsData.ts`
- Create: `apps/desktop/renderer/src/features/materials/materialMutations.ts`

**Step 1: Implementation**

```ts
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Material, MaterialCategory } from "@elektroplan/contracts";

export const MATERIAL_QUERIES = {
  categories: ["materials", "categories"] as const,
  materials: (filter: { categoryId?: string; search?: string }) =>
    ["materials", "list", filter] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: MATERIAL_QUERIES.categories,
    queryFn: () => window.elektroPlan.materials.listCategories(),
  });
}

export function useMaterials(filter: { categoryId?: string; search?: string }) {
  return useQuery({
    queryKey: MATERIAL_QUERIES.materials(filter),
    queryFn: () => window.elektroPlan.materials.list(filter),
  });
}
```

`materialMutations.ts`:

```ts
export function useMaterialMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["materials"] });

  const upsertCategory = useMutation({
    mutationFn: (c: MaterialCategory) =>
      window.elektroPlan.materials.upsertCategory(c),
    onSuccess: invalidate,
  });
  /* upsertMaterial, deleteMaterial, deleteCategory, importExcel */

  return {
    upsertCategory,
    /* … */
  };
}
```

No test for hooks (UI tests cover this end-to-end). Skip directly to:

**Step 2: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(materials): add data hooks and mutations"
```

---

## Task 13: CategoryTree component

**Files:**
- Create: `apps/desktop/renderer/src/features/materials/CategoryTree.tsx`
- Create: `apps/desktop/renderer/src/features/materials/CategoryTree.module.css`

**Step 1: Implementation**

Props: `categories`, `materialsCountByCategory`, `selectedId`, `onSelect`, `onCreate`, `onRenameRequest`, `onDeleteRequest`.

Render a list with:
- "Tümü (N)" sentinel at top
- One button per category showing `title` + count badge
- Footer: `+ Kategori` button. Clicking opens an inline input (same pattern as `ProjectQuickPanel` inline forms).

CSS: 260px width, sticky top, scrollable. Color tokens from `styles/theme.css` (search for `--color-surface`, `--color-accent`).

**Step 2: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(materials): add CategoryTree component"
```

---

## Task 14: MaterialsTable + search

**Files:**
- Create: `apps/desktop/renderer/src/features/materials/MaterialsTable.tsx`
- Create: `apps/desktop/renderer/src/features/materials/MaterialsTable.module.css`

**Step 1: Implementation**

Props: `materials`, `onEdit(material)`, `onDelete(material)`.

Header: `SIRA · AD · MARKA · MODEL · BİRİM · FİYAT · STOK · KAYNAK · ⋮`.
Rows clickable → `onEdit`. Trash icon at the end → confirm dialog → `onDelete`.

Empty state: "Bu kategoride malzeme yok — '+ Yeni Malzeme' veya 'İçe Aktar'".

`MaterialsPage` now composes: header (search input, İçe Aktar, + Yeni Malzeme) + CategoryTree (left) + MaterialsTable (right). Selected category state is local.

Wire search: debounce 200ms (`useDebouncedValue` — write a tiny hook if not present). Search clears category selection visually (shows "Tümü").

**Step 2: Manual verify**

Run the app, click "Malzemeler", click categories, type in the search, confirm table updates.

**Step 3: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(materials): add MaterialsTable and search"
```

---

## Task 15: MaterialEditDialog

**Files:**
- Create: `apps/desktop/renderer/src/features/materials/MaterialEditDialog.tsx`
- Create: `apps/desktop/renderer/src/features/materials/MaterialEditDialog.module.css`

**Step 1: Implementation**

Modal with form: name (required), category select (from categories list), unit (select with enum), unit price, stock qty, brand, model code, notes, attributes editor (rows of key/value).

Validate with `materialSchema.safeParse` before submit. On success call `upsertMaterial.mutateAsync({ … id ?? generatedId, source: existing?.source ?? "user" })` and close.

Generated id: if `existing` is `undefined`, build `${categoryId}--${slugify(name)}` (reuse `slugify` from the parser; expose it via `@elektroplan/calculation-data/scripts/...` or duplicate in `apps/desktop/renderer/src/features/materials/slugify.ts`). Append a short hash if collision in DB.

Wire from `MaterialsTable.onEdit` and from a header `+ Yeni Malzeme` button.

**Step 2: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(materials): add MaterialEditDialog with attributes editor"
```

---

## Task 16: ImportExcelDialog

**Files:**
- Create: `apps/desktop/renderer/src/features/materials/ImportExcelDialog.tsx`
- Modify: `apps/desktop/main/src/services/materials-service.ts` (if not already exposing summary fields)

**Step 1: Implementation**

Button on MaterialsPage header → opens dialog.
Dialog content:
- File picker (HTML `<input type="file" accept=".xlsx">`). Use `path` from `File` if available; otherwise post the file via an Electron file-open dialog (`window.elektroPlan.materials.pickExcel()` — add a small IPC if needed, but the cheapest is to require a path which we get via `dialog.showOpenDialog` in main; add a new channel `MaterialsPickExcel`).
- Mode radio (default Merge, Replace disabled with "ileride").
- Result panel: shows summary numbers once the mutation resolves.

Wire `useMaterialMutations().importExcel` to call `window.elektroPlan.materials.importExcel(path, "merge")`.

**Step 2: Manual verify**

Pick the `docs/MST malzeme listesi.xlsx` file, submit, confirm summary, confirm catalog reflects the import.

**Step 3: Commit**

```bash
git add apps/desktop
git commit -m "feat(materials): add Excel import dialog with merge summary"
```

---

## Task 17: AssignMaterialPopover

**Files:**
- Create: `apps/desktop/renderer/src/features/projects/AssignMaterialPopover.tsx`
- Create: `apps/desktop/renderer/src/features/projects/AssignMaterialPopover.module.css`
- Create: `apps/desktop/renderer/src/features/projects/useRecordAssignments.ts`

**Step 1: useRecordAssignments hook**

```ts
export function useRecordAssignments(recordIds: readonly string[]) {
  return useQuery({
    queryKey: ["assignments", [...recordIds].sort()],
    queryFn: () =>
      recordIds.length
        ? window.elektroPlan.assignments.listForRecords([...recordIds])
        : [],
    enabled: recordIds.length > 0,
  });
}
```

**Step 2: Popover**

Props: `anchorEl`, `recordId`, `onClose`, `onAssigned`.

Inputs: search box (debounced, hits `window.elektroPlan.materials.list({ search })`), result list (max 10), focusable with ↑↓ + Enter. Selected material shows a small footer row: `Adet [ 1 ] [ Ekle ]`.

On Ekle: build snapshot from the selected material, call `window.elektroPlan.assignments.upsert({ ... })` with `id = newId()`. Invalidate `["assignments"]`.

Position: a simple absolute popover keyed off the trigger button rect; no Floating UI dependency required.

**Step 3: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(projects): add AssignMaterialPopover and useRecordAssignments hook"
```

---

## Task 18: Quick Panel integration

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx`
- Modify: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.module.css`

**Step 1: Implementation**

Collect every record id rendered (the existing `activeProject?.groups.flatMap(g => g.records.map(r => r.record.id))`). Pass to `useRecordAssignments`. Group results by `recordId` in a memoized `Record<string, MaterialAssignment[]>`.

Inside each `recordCard` add below `recordMeta`:

```tsx
<div className={styles.assignBlock}>
  <div className={styles.assignHeader}>
    <span>Malzemeler ({assignmentsForRecord.length})</span>
    <button type="button" className={styles.linkBtn} onClick={() => openAssignPopover(record.id)}>
      + Malzeme
    </button>
  </div>
  {assignmentsForRecord.length === 0 ? null : (
    <ul className={styles.assignList}>
      {assignmentsForRecord.map((a) => (
        <li key={a.id} className={styles.assignRow}>
          <span className={styles.assignName}>{a.snapshotName}</span>
          <span className={styles.assignQty}>{a.quantity}{a.unit ? ` ${a.unit}` : "×"}</span>
          <button onClick={() => removeAssignment(a.id)} aria-label="Sil">×</button>
        </li>
      ))}
    </ul>
  )}
</div>
```

`openAssignPopover(recordId)` sets a single local state and renders `<AssignMaterialPopover>` anchored to the clicked button. On close, clear state and invalidate `["assignments"]`.

`removeAssignment(id)` calls `window.elektroPlan.assignments.delete(id)` and invalidates.

**Step 2: Manual verify (end-to-end smoke)**

1. Start app.
2. On Motor page calculate a motor and save into a group/project.
3. Open Quick Panel — confirm the motor card shows.
4. Click `+ Malzeme` → popover opens → search "AF" → pick `AF38` → set adet 1 → Ekle.
5. Card shows the chip. Reload app. Chip still there.
6. Open `/materials`, find `AF38`, change brand to "ABB / X". Go back to Quick Panel — chip still says the snapshot. (Snapshot correctness check.)
7. From `/materials`, delete `AF38`. Quick Panel chip still shows the snapshot name; nothing crashes.

**Step 3: Commit**

```bash
git add apps/desktop/renderer
git commit -m "feat(quick-panel): per-record material assignment chips"
```

---

## Task 19: Renderer query invalidation on record delete

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/projectMutations.ts`

After record delete, also invalidate `["assignments"]`. (Records cascade delete on the server side; the client cache must drop them too.)

**Step 1: Commit**

```bash
git add apps/desktop/renderer
git commit -m "fix(projects): invalidate assignments after record delete"
```

---

## Task 20: Manual QA checklist + final commit

Run, in order:

1. `pnpm -w turbo run typecheck`
2. `pnpm -w turbo run test`
3. `pnpm -w turbo run lint`
4. Launch the desktop app. Walk through these manual scenarios:
   - First launch on an empty DB seeds ~40 categories, ~280 materials.
   - Re-running the app does not re-seed.
   - Adding a user material, then importing the Excel again, keeps the user material.
   - Editing a user material updates the catalog.
   - Deleting a category with materials shows an error toast.
   - Quick Panel assignment add/delete/show works for motor, cable, voltage-drop, protection records.
   - Snapshot persists after catalog edits and deletes.
   - Theme switch (light/dark/cream) — materials page is readable on each.

5. If everything is green, push the branch and open a PR titled `feat: materials catalog and per-record assignments`.

```bash
git push -u origin <branch>
gh pr create --title "feat: materials catalog and per-record assignments" --body "$(cat <<'EOF'
## Summary
- Centralized materials catalog with categorized CRUD, sidebar entry, and /materials page
- Excel seed pipeline + runtime merge re-import from docs/MST malzeme listesi.xlsx
- Per-record material assignments with snapshot pattern (catalog edits don't mutate past assignments)
- Quick Panel integration: chips + AssignMaterialPopover on every record card

## Test plan
- [x] typecheck, lint, unit tests green
- [x] First-launch seed verified
- [x] Re-import merge keeps user rows
- [x] Quick Panel add/remove/persist
- [x] Snapshot integrity after catalog edits/deletes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Touchpoint Index (quick reference for the executing agent)

- Schemas: [`packages/contracts/src/schemas.ts`](../../packages/contracts/src/schemas.ts)
- Seed pipeline: `packages/calculation-data/scripts/build-materials-seed.mjs`
- Seed JSON: `packages/calculation-data/src/datasets/materials.json`
- Migrations: [`packages/storage/src/migrations.ts`](../../packages/storage/src/migrations.ts)
- Repositories: [`packages/storage/src/repositories.ts`](../../packages/storage/src/repositories.ts)
- IPC channels: `apps/desktop/main/src/ipc/channels.ts`
- IPC register: `apps/desktop/main/src/ipc/register.ts`
- Materials service: `apps/desktop/main/src/services/materials-service.ts`
- Preload bridge: [`apps/desktop/preload/src/index.ts`](../../apps/desktop/preload/src/index.ts)
- Router: `apps/desktop/renderer/src/router.tsx`
- Sidebar: [`apps/desktop/renderer/src/ui/Layout.tsx`](../../apps/desktop/renderer/src/ui/Layout.tsx)
- Materials feature: `apps/desktop/renderer/src/features/materials/`
- Quick panel: [`apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx`](../../apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx)
- Companion design: [`2026-05-19-materials-feature-design.md`](2026-05-19-materials-feature-design.md)
