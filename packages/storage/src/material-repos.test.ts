import { describe, expect, it } from "vitest";

import type { CalculationRecord, Material, MaterialAssignment, MaterialCategory } from "@elektroplan/contracts";

import { openStorageDatabase } from "./index.js";

function createCategory(overrides: Partial<MaterialCategory> = {}): MaterialCategory {
  return {
    id: "cat-default",
    title: "Default",
    ...overrides,
  };
}

function createMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: "mat-default",
    categoryId: "cat-default",
    name: "Default Material",
    source: "user",
    ...overrides,
  };
}

type MotorRecord = Extract<CalculationRecord, { calculator: "motor" }>;

function createRecord(overrides: Partial<MotorRecord> = {}): MotorRecord {
  return {
    calculator: "motor",
    id: "record-default",
    input: {
      P_out: 5.5,
      cosPhi: 0.82,
      efficiencyPercent: 90,
      mode: "formula",
      phase: 3,
      voltage: 400,
      voltageMode: "LL",
    },
    output: {
      assumptions: [],
      dataVersion: "data@2026.05",
      engineVersion: "engine@2026.05",
      formulaVariant: "iec-60364-motor-formula-v1",
      value: {
        P_out: 5.5,
        apparentPowerKVA: 6.8,
        cosPhi: 0.82,
        currentA: 9.8,
        efficiencyPercent: 90,
        inputPowerKW: 6.1,
        mode: "formula",
        phase: 3,
        voltage: 400,
        voltageMode: "LL",
      },
      warnings: [],
    },
    title: "Default Record",
    version: {
      contractVersion: "contracts@1",
      dataVersion: "data@2026.05",
      engineVersion: "engine@2026.05",
    },
    ...overrides,
  } satisfies MotorRecord;
}

function createAssignment(overrides: Partial<MaterialAssignment> = {}): MaterialAssignment {
  return {
    id: "assignment-default",
    materialId: "mat-default",
    orderValue: 1,
    quantity: 2,
    recordId: "record-default",
    snapshotCategoryId: "cat-default",
    snapshotCategoryTitle: "Default",
    snapshotName: "Default Material",
    unit: "m",
    ...overrides,
  };
}

describe("material category repositories", () => {
  it("upserts categories and lists them by orderValue then title then id with nulls last", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });

    const inserted = storage.repositories.materialCategories.upsert(
      createCategory({ id: "b", title: "Beta", orderValue: 2, iconKey: "plug" }),
    );
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "a", title: "Alpha", orderValue: 2 }),
    );
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "c", title: "Gamma" }),
    );
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "d", title: "Delta", orderValue: 1 }),
    );

    const updated = storage.repositories.materialCategories.upsert(
      createCategory({ id: "b", title: "Beta Updated", orderValue: 2, iconKey: "bolt" }),
    );

    expect(updated.createdAt).toBe(inserted.createdAt);
    expect(updated.updatedAt).not.toBe(inserted.updatedAt);
    expect(storage.repositories.materialCategories.list().map((category) => category.id)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
    expect(storage.repositories.materialCategories.list()[2]).toMatchObject({
      iconKey: "bolt",
      title: "Beta Updated",
    });

    storage.close();
  });

  it("deletes an existing category and reports false for a missing id", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.materialCategories.upsert(createCategory({ id: "cat-1", title: "Panel" }));

    expect(storage.repositories.materialCategories.delete("cat-1")).toBe(true);
    expect(storage.repositories.materialCategories.list()).toEqual([]);
    expect(storage.repositories.materialCategories.delete("missing-cat")).toBe(false);

    storage.close();
  });
});

describe("materials repositories", () => {
  it("upserts materials and lists them by category", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-cable", title: "Cable" }),
    );
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-panel", title: "Panel" }),
    );

    const inserted = storage.repositories.materials.upsert(
      createMaterial({
        id: "mat-1",
        categoryId: "cat-cable",
        name: "NYY Cable",
        brand: "TopBrand",
        attributes: { coreCount: 4, shielded: true, color: "black", note: null },
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "mat-2",
        categoryId: "cat-panel",
        name: "Panel Box",
      }),
    );

    const updated = storage.repositories.materials.upsert(
      createMaterial({
        id: "mat-1",
        categoryId: "cat-cable",
        name: "NYY Cable Updated",
        brand: "TopBrand",
        attributes: { coreCount: 5, shielded: false },
      }),
    );

    expect(updated.createdAt).toBe(inserted.createdAt);
    expect(updated).toMatchObject({
      id: "mat-1",
      categoryId: "cat-cable",
      name: "NYY Cable Updated",
      brand: "TopBrand",
      attributes: { coreCount: 5, shielded: false },
    });
    expect(storage.repositories.materials.list({ categoryId: "cat-cable" })).toHaveLength(1);
    expect(storage.repositories.materials.list({ categoryId: "cat-cable" })[0]).toMatchObject({
      attributes: { coreCount: 5, shielded: false },
      brand: "TopBrand",
      categoryId: "cat-cable",
      id: "mat-1",
      name: "NYY Cable Updated",
    });

    storage.close();
  });

  it("searches materials case-insensitively across name, brand and modelCode", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-search", title: "Searchable" }),
    );

    storage.repositories.materials.upsert(
      createMaterial({
        id: "match-name",
        categoryId: "cat-search",
        name: "Alpha Contact Block",
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "match-brand",
        categoryId: "cat-search",
        name: "Auxiliary Relay",
        brand: "Siemens",
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "match-model",
        categoryId: "cat-search",
        name: "Terminal",
        modelCode: "3RV2021",
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "no-match",
        categoryId: "cat-search",
        name: "Cable Duct",
        brand: "Phoenix",
        modelCode: "WD-100",
      }),
    );

    expect(storage.repositories.materials.list({ search: "alpha" }).map((item) => item.id)).toEqual([
      "match-name",
    ]);
    expect(storage.repositories.materials.list({ search: "SIEM" }).map((item) => item.id)).toEqual([
      "match-brand",
    ]);
    expect(storage.repositories.materials.list({ search: "3rv" }).map((item) => item.id)).toEqual([
      "match-model",
    ]);

    storage.close();
  });

  it("searches Turkish and other non-ASCII text case-insensitively across name, brand and modelCode", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-unicode", title: "Unicode" }),
    );

    storage.repositories.materials.upsert(
      createMaterial({
        id: "unicode-name",
        categoryId: "cat-unicode",
        name: "İletken Kablo",
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "unicode-brand",
        categoryId: "cat-unicode",
        name: "Buat",
        brand: "ÖZNUR",
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "unicode-model",
        categoryId: "cat-unicode",
        name: "Şalter",
        modelCode: "ŞALT-İX",
      }),
    );

    expect(
      storage.repositories.materials.list({ search: "iletken" }).map((item) => item.id),
    ).toEqual(["unicode-name"]);
    expect(storage.repositories.materials.list({ search: "öznur" }).map((item) => item.id)).toEqual([
      "unicode-brand",
    ]);
    expect(storage.repositories.materials.list({ search: "şalt-ix" }).map((item) => item.id)).toEqual([
      "unicode-model",
    ]);

    storage.close();
  });

  it("matches numeric punctuation interchangeably and supports multi-token search", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-numeric", title: "Numeric" }),
    );

    storage.repositories.materials.upsert(
      createMaterial({
        id: "ms116-4",
        categoryId: "cat-numeric",
        name: "MS116-4 (4-6,3A)",
        brand: "ABB",
      }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "ms116-10",
        categoryId: "cat-numeric",
        name: "MS116-10 (6,3-10A)",
        brand: "ABB",
      }),
    );

    // dot/comma interchangeable
    expect(
      storage.repositories.materials.list({ search: "4-6.3" }).map((item) => item.id),
    ).toEqual(["ms116-4"]);
    expect(
      storage.repositories.materials.list({ search: "6,3-10" }).map((item) => item.id),
    ).toEqual(["ms116-10"]);

    // multi-token AND across fields
    expect(
      storage.repositories.materials.list({ search: "abb ms116-4" }).map((item) => item.id),
    ).toEqual(["ms116-4"]);

    storage.close();
  });

  it("throws when deleting a category that still has materials", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-protected", title: "Protected" }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "mat-protected",
        categoryId: "cat-protected",
        name: "Protected Material",
      }),
    );

    expect(() => storage.repositories.materialCategories.delete("cat-protected")).toThrow();

    storage.close();
  });
});

describe("material assignments repository", () => {
  it("upserts assignments and lists them for selected record ids", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.records.upsert(createRecord({ id: "record-1" }));
    storage.repositories.records.upsert(createRecord({ id: "record-2", title: "Other Record" }));
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-cable", title: "Cable" }),
    );
    storage.repositories.materials.upsert(
      createMaterial({ id: "mat-cable", categoryId: "cat-cable", name: "NYY Cable" }),
    );

    const inserted = storage.repositories.assignments.upsert(
      createAssignment({
        id: "assignment-1",
        materialId: "mat-cable",
        quantity: 12,
        recordId: "record-1",
        snapshotCategoryId: "cat-cable",
        snapshotCategoryTitle: "Cable",
        snapshotName: "NYY Cable",
        unit: "m",
      }),
    );

    const updated = storage.repositories.assignments.upsert(
      createAssignment({
        id: "assignment-1",
        materialId: "mat-cable",
        quantity: 15,
        recordId: "record-1",
        snapshotBrand: "TopBrand",
        snapshotCategoryId: "cat-cable",
        snapshotCategoryTitle: "Cable",
        snapshotName: "NYY Cable 4x10",
        snapshotUnitPrice: 42.5,
        unit: "m",
      }),
    );

    expect(updated.createdAt).toBe(inserted.createdAt);
    expect(storage.repositories.assignments.listForRecords(["record-1"])).toEqual([
      expect.objectContaining({
        id: "assignment-1",
        materialId: "mat-cable",
        quantity: 15,
        recordId: "record-1",
        snapshotBrand: "TopBrand",
        snapshotCategoryId: "cat-cable",
        snapshotCategoryTitle: "Cable",
        snapshotName: "NYY Cable 4x10",
        snapshotUnitPrice: 42.5,
        unit: "m",
      }),
    ]);
    expect(storage.repositories.assignments.listForRecords(["record-2"])).toEqual([]);

    storage.close();
  });

  it("sets materialId to null when the material is deleted but preserves snapshot fields", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.records.upsert(createRecord({ id: "record-1" }));
    storage.repositories.materialCategories.upsert(
      createCategory({ id: "cat-panel", title: "Panel" }),
    );
    storage.repositories.materials.upsert(
      createMaterial({
        id: "mat-panel",
        categoryId: "cat-panel",
        name: '36M "Metal" Panel',
        brand: "PanoTech",
        attributes: { poles: 36, lockable: true },
        unitPrice: 1800,
      }),
    );
    storage.repositories.assignments.upsert(
      createAssignment({
        id: "assignment-panel",
        materialId: "mat-panel",
        quantity: 1,
        recordId: "record-1",
        snapshotAttributes: { poles: 36, lockable: true },
        snapshotBrand: "PanoTech",
        snapshotCategoryId: "cat-panel",
        snapshotCategoryTitle: "Panel",
        snapshotName: '36M "Metal" Panel',
        snapshotUnitPrice: 1800,
        unit: "adet",
      }),
    );

    expect(storage.repositories.materials.delete("mat-panel")).toBe(true);
    expect(storage.repositories.assignments.listForRecords(["record-1"])).toEqual([
      expect.objectContaining({
        id: "assignment-panel",
        materialId: null,
        quantity: 1,
        recordId: "record-1",
        snapshotAttributes: { poles: 36, lockable: true },
        snapshotBrand: "PanoTech",
        snapshotCategoryId: "cat-panel",
        snapshotCategoryTitle: "Panel",
        snapshotName: '36M "Metal" Panel',
        snapshotUnitPrice: 1800,
        unit: "adet",
      }),
    ]);

    storage.close();
  });

  it("returns an empty list without querying invalid SQL when record ids are empty", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });

    expect(storage.repositories.assignments.listForRecords([])).toEqual([]);

    storage.close();
  });
});
