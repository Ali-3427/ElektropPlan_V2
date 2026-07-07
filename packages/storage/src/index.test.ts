import { describe, expect, it } from "vitest";
import { z } from "zod";
import Database from "better-sqlite3";

import type { CalculationGroup, CalculationRecord, Material, MaterialCategory } from "@elektroplan/contracts";

import { openStorageDatabase } from "./index.js";
import { applyMigrations } from "./migrations.js";

function createDatabase(): Database.Database {
  const db = new Database(":memory:");
  applyMigrations(db);
  return db;
}

function createGroup(): CalculationGroup {
  return {
    id: "history-main",
    order: 1,
    tags: ["history", "motor"],
    title: "Main History",
    version: {
      contractVersion: "contracts@1",
      dataVersion: "data@2026.04",
      engineVersion: "engine@2026.04",
    },
  };
}

function createMotorRecord(overrides: Partial<CalculationRecord> = {}): CalculationRecord {
  return {
    calculator: "motor",
    grouping: {
      groupId: "history-main",
      groupPath: ["History", "Motors"],
      groupTitle: "Main History",
      order: 3,
      tags: ["saved", "motor"],
    },
    id: "motor-001",
    input: {
      P_out: 7.5,
      cosPhi: 0.82,
      efficiencyPercent: 89,
      mode: "formula",
      phase: 3,
      voltage: 400,
      voltageMode: "LL",
    },
    output: {
      assumptions: [],
      dataVersion: "data@2026.04",
      engineVersion: "engine@2026.04",
      formulaVariant: "iec-60364-motor-formula-v1",
      value: {
        P_out: 7.5,
        apparentPowerKVA: 8.4,
        cosPhi: 0.82,
        currentA: 12.2,
        efficiencyPercent: 89,
        inputPowerKW: 8.43,
        mode: "formula",
        phase: 3,
        voltage: 400,
        voltageMode: "LL",
      },
      warnings: [],
    },
    title: "Workshop Motor",
    version: {
      contractVersion: "contracts@1",
      dataVersion: "data@2026.04",
      engineVersion: "engine@2026.04",
    },
    ...overrides,
  } as CalculationRecord;
}

function createMaterialCategory(): MaterialCategory {
  return {
    iconKey: "cable",
    id: "cat-cable",
    orderValue: 1,
    title: "Cable",
  };
}

function createMaterial(overrides: Partial<Material> = {}): Material {
  return {
    attributes: { cores: 3 },
    brand: "TopBrand",
    categoryId: "cat-cable",
    id: "mat-nyy-3x25",
    modelCode: "NYY-3X25",
    name: "NYY 3x25",
    notes: "Copper cable",
    orderValue: 2,
    source: "user",
    stockQty: 120,
    unit: "m",
    unitPrice: 45.5,
    ...overrides,
  };
}

describe("storage package", () => {
  it("persists and reloads versioned groups and records", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });

    const savedGroup = storage.repositories.groups.upsert(createGroup());
    const savedRecord = storage.repositories.records.upsert(createMotorRecord());

    expect(savedGroup.createdAt).toBeTruthy();
    expect(savedGroup.updatedAt).toBeTruthy();
    expect(savedRecord.version.engineVersion).toBe("engine@2026.04");
    expect(savedRecord.calculator).toBe("motor");
    if (savedRecord.calculator !== "motor") {
      throw new Error("Expected a motor record.");
    }
    expect(savedRecord.output.engineVersion).toBe("engine@2026.04");
    expect(storage.repositories.records.getById(savedRecord.id)).toEqual(savedRecord);
    expect(storage.repositories.records.list({ groupId: "history-main" })).toEqual([savedRecord]);

    storage.close();
  });

  it("applies migrations before repositories are used", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });

    expect(storage.repositories.groups.list()).toEqual([]);
    expect(storage.repositories.records.list()).toEqual([]);
    expect(storage.repositories.settings.list()).toEqual([]);

    storage.close();
  });

  it("stores settings with typed retrieval", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });

    storage.repositories.settings.set("ui.preferences", {
      defaultVoltageDropProfileId: "power-5pct",
      firmName: "ElektroPlan",
      locale: "tr-TR",
    });

    const loaded = storage.repositories.settings.get<{
      defaultVoltageDropProfileId: string;
      firmName: string;
      locale: string;
    }>(
      "ui.preferences",
      z.object({
        defaultVoltageDropProfileId: z.string(),
        firmName: z.string(),
        locale: z.string(),
      }),
    );

    expect(loaded?.value.defaultVoltageDropProfileId).toBe("power-5pct");
    expect(loaded?.createdAt).toBeTruthy();
    expect(loaded?.updatedAt).toBeTruthy();

    storage.close();
  });

  it("exports a contract-aligned snapshot for replay", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });
    storage.repositories.groups.upsert(createGroup());
    storage.repositories.records.upsert(createMotorRecord());
    storage.repositories.materialCategories.upsert(createMaterialCategory());
    storage.repositories.materials.upsert(createMaterial());
    storage.repositories.materials.upsert(
      createMaterial({
        id: "mat-seeded-1",
        modelCode: "SEED-001",
        name: "Seeded Cable",
        notes: "From bundled catalog",
        seedDataVersion: "materials-2026-05-19",
        source: "seed",
      }),
    );

    const snapshot = storage.repositories.exportSnapshot({
      contractVersion: "contracts@1",
      dataVersion: "data@2026.04",
      engineVersion: "engine@2026.04",
    });

    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0]?.version.engineVersion).toBe("engine@2026.04");
    expect(snapshot.materialCategories).toEqual([
      {
        iconKey: "cable",
        id: "cat-cable",
        orderValue: 1,
        title: "Cable",
      },
    ]);
    expect(snapshot.materials).toEqual([
      {
        attributes: { cores: 3 },
        brand: "TopBrand",
        categoryId: "cat-cable",
        id: "mat-nyy-3x25",
        modelCode: "NYY-3X25",
        name: "NYY 3x25",
        notes: "Copper cable",
        orderValue: 2,
        source: "user",
        stockQty: 120,
        unit: "m",
        unitPrice: 45.5,
      },
      {
        attributes: { cores: 3 },
        brand: "TopBrand",
        categoryId: "cat-cable",
        id: "mat-seeded-1",
        modelCode: "SEED-001",
        name: "Seeded Cable",
        notes: "From bundled catalog",
        orderValue: 2,
        seedDataVersion: "materials-2026-05-19",
        source: "seed",
        stockQty: 120,
        unit: "m",
        unitPrice: 45.5,
      },
    ]);
    expect(snapshot.materialAssignments).toEqual([]);

    storage.close();
  });

  it("p3 creates materials, material_categories and material_assignments tables", () => {
    const db = createDatabase();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining(["material_categories", "materials", "material_assignments"]),
    );

    db.close();
  });

  it("p3 enforces CASCADE delete from records to material_assignments", () => {
    const db = createDatabase();

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

    const remaining = db.prepare("SELECT COUNT(*) as n FROM material_assignments").get() as {
      n: number;
    };
    expect(remaining.n).toBe(0);

    db.close();
  });
});

describe("cascade delete", () => {
  it("deletes child groups, records, and assignments when a project group is deleted, without touching a sibling project's tree", () => {
    const storage = openStorageDatabase({ filename: ":memory:" });

    storage.repositories.groups.upsert({
      id: "proj-1",
      title: "P",
      tags: ["project"],
      version: { contractVersion: "1" },
    });
    storage.repositories.groups.upsert({
      id: "grp-1",
      title: "G",
      parentGroupId: "proj-1",
      version: { contractVersion: "1" },
    });
    storage.repositories.records.upsert(
      createMotorRecord({
        id: "rec-1",
        grouping: { groupId: "grp-1" },
      }),
    );
    storage.repositories.materialCategories.upsert(createMaterialCategory());
    storage.repositories.materials.upsert(createMaterial());
    storage.repositories.assignments.upsert({
      id: "asg-1",
      recordId: "rec-1",
      materialId: "mat-nyy-3x25",
      quantity: 2,
      unit: "m",
      snapshotName: "NYY 3x25",
      snapshotCategoryId: "cat-cable",
      snapshotCategoryTitle: "Cable",
    });

    // A second, independent project tree that must survive deletion of proj-1.
    storage.repositories.groups.upsert({
      id: "proj-2",
      title: "P2",
      tags: ["project"],
      version: { contractVersion: "1" },
    });
    storage.repositories.groups.upsert({
      id: "grp-2",
      title: "G2",
      parentGroupId: "proj-2",
      version: { contractVersion: "1" },
    });
    storage.repositories.records.upsert(
      createMotorRecord({
        id: "rec-2",
        grouping: { groupId: "grp-2" },
      }),
    );
    storage.repositories.assignments.upsert({
      id: "asg-2",
      recordId: "rec-2",
      materialId: "mat-nyy-3x25",
      quantity: 5,
      unit: "m",
      snapshotName: "NYY 3x25",
      snapshotCategoryId: "cat-cable",
      snapshotCategoryTitle: "Cable",
    });

    expect(storage.repositories.groups.delete("proj-1")).toBe(true);

    expect(storage.repositories.groups.getById("grp-1")).toBeNull();
    expect(storage.repositories.records.getById("rec-1")).toBeNull();
    expect(storage.repositories.assignments.listForRecords(["rec-1"])).toHaveLength(0);

    // Sibling project's tree must be unaffected by the cascade.
    expect(storage.repositories.groups.getById("proj-2")).not.toBeNull();
    expect(storage.repositories.groups.getById("grp-2")).not.toBeNull();
    expect(storage.repositories.records.getById("rec-2")).not.toBeNull();
    expect(storage.repositories.assignments.listForRecords(["rec-2"])).toHaveLength(1);

    storage.close();
  });
});
