import type { Material, MaterialCategory } from "@elektroplan/contracts";
import xlsx from "xlsx";

const TURKISH_MAP: Readonly<Record<string, string>> = {
  "\u00e7": "c",
  "\u00c7": "c",
  "\u011f": "g",
  "\u011e": "g",
  "\u0131": "i",
  "\u0130": "i",
  "\u00f6": "o",
  "\u00d6": "o",
  "\u015f": "s",
  "\u015e": "s",
  "\u00fc": "u",
  "\u00dc": "u",
};

const SKIP_FIRST_ROWS = new Set(["MST MALZEME L\u0130STES\u0130", "KATEGOR\u0130"]);

export interface ParsedMaterialsWorkbook {
  readonly categories: MaterialCategory[];
  readonly materials: Material[];
  readonly dataVersion: string;
}

export function slugify(input: unknown): string {
  const lowered = String(input)
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("")
    .toLowerCase();

  return lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function parseMaterialsWorkbook(
  rows: readonly (readonly unknown[])[],
  options?: { readonly dataVersion?: string },
): ParsedMaterialsWorkbook {
  const dataVersion = options?.dataVersion ?? "materials-unversioned";
  const categories: MaterialCategory[] = [];
  const materials: Material[] = [];
  let activeCategory: string | null = null;
  let categoryOrder = 0;

  for (const row of rows) {
    const a = String(row[0] ?? "").trim();
    const b = row[1];
    const c = String(row[2] ?? "").trim();

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
      const material: Material = {
        id,
        categoryId: activeCategory,
        name: c,
        source: "seed",
        seedDataVersion: dataVersion,
      };

      if (Number.isFinite(orderValue)) {
        material.orderValue = orderValue;
      }

      materials.push(material);
    }
  }

  return { categories, materials, dataVersion };
}

export function readWorkbookRows(filePath: string): unknown[][] {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (sheetName === undefined) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  if (sheet === undefined) {
    return [];
  }

  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
}
