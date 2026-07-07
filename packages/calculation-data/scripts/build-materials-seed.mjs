#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import xlsx from "xlsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const DEFAULT_INPUT = resolve(REPO_ROOT, "docs", "MST malzeme listesi.xlsx");
const DEFAULT_OUTPUT = resolve(
  PACKAGE_ROOT,
  "src",
  "dataset",
  "materials",
  "dataset.json",
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
  return lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
        typeof b === "number"
          ? Math.trunc(b)
          : Number.parseInt(String(b ?? ""), 10);
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
      source: "docs/MST malzeme listesi.xlsx",
      validFrom: new Date().toISOString().slice(0, 10),
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
