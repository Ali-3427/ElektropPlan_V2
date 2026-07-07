declare module "@elektroplan/calculation-data/scripts/build-materials-seed.mjs" {
  import type { Material, MaterialCategory } from "@elektroplan/contracts";

  export interface ParsedMaterialsWorkbook {
    readonly categories: MaterialCategory[];
    readonly materials: Material[];
    readonly dataVersion: string;
  }

  export function slugify(input: unknown): string;
  export function parseMaterialsWorkbook(
    rows: readonly unknown[][],
    options?: { readonly dataVersion?: string },
  ): ParsedMaterialsWorkbook;
  export function readWorkbookRows(filePath: string): unknown[][];
}
