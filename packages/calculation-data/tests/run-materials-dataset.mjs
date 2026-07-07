import assert from "node:assert/strict";

import { getMaterialSeed, materialDataset } from "../dist/index.js";

assert.ok(materialDataset, "materialDataset must be exported");
assert.equal(materialDataset.metadata.id, "materials");
assert.equal(materialDataset.metadata.standard, "internal");
assert.match(materialDataset.metadata.revision, /^materials-/);

const seed = getMaterialSeed();

// Sanity counts — the production dataset has ~40 categories and ~280 materials.
// Use a lower bound to keep the test resilient to minor Excel edits.
assert.ok(seed.categories.length >= 10, `expected >= 10 categories, got ${seed.categories.length}`);
assert.ok(seed.materials.length >= 50, `expected >= 50 materials, got ${seed.materials.length}`);

// Every material references an existing category.
const categoryIds = new Set(seed.categories.map((c) => c.id));
for (const material of seed.materials) {
  assert.ok(
    categoryIds.has(material.categoryId),
    `material ${material.id} references missing category ${material.categoryId}`,
  );
}

// Every material id is unique.
const seenMaterialIds = new Set();
for (const material of seed.materials) {
  assert.ok(!seenMaterialIds.has(material.id), `duplicate material id ${material.id}`);
  seenMaterialIds.add(material.id);
}

// Every category id is unique.
const seenCategoryIds = new Set();
for (const category of seed.categories) {
  assert.ok(!seenCategoryIds.has(category.id), `duplicate category id ${category.id}`);
  seenCategoryIds.add(category.id);
}

// dataVersion mirrors metadata.revision.
assert.equal(seed.dataVersion, materialDataset.metadata.revision);

// Materials are frozen (deepFreeze from loadJsonDataset).
const firstMaterial = seed.materials[0];
assert.ok(Object.isFrozen(firstMaterial));
assert.ok(Object.isFrozen(seed.materials));

console.log("materials-dataset test ok");
