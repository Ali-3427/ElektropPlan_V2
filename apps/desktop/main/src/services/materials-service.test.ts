import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { openStorageDatabase } from "@elektroplan/storage";

import { createMaterialsService } from "./materials-service.js";

function newService() {
  const db = openStorageDatabase({ filename: ":memory:" });
  return { db, service: createMaterialsService(db.repositories) };
}

const FIXTURE_XLSX_PATH = resolve(
  "docs",
  "MST malzeme listesi.xlsx",
);

describe("materials service", () => {
  it("seedIfEmpty loads the calculation-data seed when materials table is empty", async () => {
    const { db, service } = newService();

    const result = await service.seedIfEmpty();
    assert.equal(result.seeded, true);
    assert.ok(db.repositories.materials.list({}).length > 50);

    const second = await service.seedIfEmpty();
    assert.equal(second.seeded, false);

    db.close();
  });

  it("importExcel merges without touching user rows", async () => {
    const { db, service } = newService();

    await service.seedIfEmpty();

    const categories = db.repositories.materialCategories.list();
    assert.ok(categories.length > 0);

    db.repositories.materials.upsert({
      id: "custom--my-thing",
      categoryId: categories[0]!.id,
      name: "My custom",
      source: "user",
    });

    const summary = await service.importExcel({
      filePath: FIXTURE_XLSX_PATH,
      mode: "merge",
    });

    assert.ok(summary.materialsAdded + summary.materialsUpdated > 0);
    assert.equal(
      db.repositories.materials.list({}).some((material) => material.id === "custom--my-thing"),
      true,
    );

    db.close();
  });

  it("upsertMaterial accepts a persisted material without timestamp metadata leaking into validation", async () => {
    const { db, service } = newService();

    await service.seedIfEmpty();

    const existing = db.repositories.materials.list({})[0]!;
    const updated = service.upsertMaterial({
      ...existing,
      brand: "Updated Brand",
      unit: "adet",
    });

    assert.equal(updated.id, existing.id);
    assert.equal(updated.brand, "Updated Brand");
    assert.equal(updated.unit, "adet");

    db.close();
  });
});
