import assert from "node:assert/strict";

import { parseMaterialsWorkbook, slugify } from "../dist/materials-workbook.js";

// slugify normalizes Turkish characters
assert.equal(slugify("KAÇAK AKIM KORUMA RÖLELERİ"), "kacak-akim-koruma-roleleri");
assert.equal(slugify("C40 3X40A+N"), "c40-3x40a-n");
assert.equal(slugify("  Leading & trailing  "), "leading-trailing");

// parseMaterialsWorkbook groups rows into categories and produces deterministic ids
const fixtureRows = [
  ["MST MALZEME LİSTESİ", null, null],
  ["KATEGORİ", "SIRA NO", "MALZEME ADI"],
  ["KAÇAK AKIM KORUMA RÖLELERİ", null, null],
  [null, 1, "KAKR 40A 30mA"],
  [null, 2, "KAKR 25A 30mA FAZ+NÖTR"],
  ["OTOMATİK SİGORTALAR - C TİPİ", null, null],
  [null, 1, "C80 3x80A"],
];

const result = parseMaterialsWorkbook(fixtureRows, { dataVersion: "materials-test" });

assert.equal(result.categories.length, 2);
assert.deepEqual(result.categories[0], {
  id: "kacak-akim-koruma-roleleri",
  title: "KAÇAK AKIM KORUMA RÖLELERİ",
  orderValue: 1,
});
assert.deepEqual(result.categories[1], {
  id: "otomatik-sigortalar-c-tipi",
  title: "OTOMATİK SİGORTALAR - C TİPİ",
  orderValue: 2,
});

assert.equal(result.materials.length, 3);
assert.deepEqual(result.materials[0], {
  id: "kacak-akim-koruma-roleleri--kakr-40a-30ma",
  categoryId: "kacak-akim-koruma-roleleri",
  name: "KAKR 40A 30mA",
  orderValue: 1,
  source: "seed",
  seedDataVersion: "materials-test",
});

// Deterministic across runs
const a = parseMaterialsWorkbook(fixtureRows, { dataVersion: "v" });
const b = parseMaterialsWorkbook(fixtureRows, { dataVersion: "v" });
assert.deepEqual(a, b);

// Skips header rows; ignores rows without an active category
const rowsWithoutCategory = [
  [null, 1, "Orphan item"],
];
const empty = parseMaterialsWorkbook(rowsWithoutCategory, { dataVersion: "v" });
assert.equal(empty.materials.length, 0);

// Row with numeric SIRA gets coerced to int
const rowsWithStringSira = [
  ["X", null, null],
  [null, "3", "Item"],
];
const parsed = parseMaterialsWorkbook(rowsWithStringSira, { dataVersion: "v" });
assert.equal(parsed.materials[0].orderValue, 3);

console.log("materials-seed test ok");
