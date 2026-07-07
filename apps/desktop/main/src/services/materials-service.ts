import {
  getMaterialSeed,
  parseMaterialsWorkbook,
  readWorkbookRows,
} from "@elektroplan/calculation-data";
import {
  materialAssignmentSchema,
  materialCategorySchema,
  materialSchema,
} from "@elektroplan/contracts";
import type { StorageRepositories } from "@elektroplan/storage";
import { z } from "zod";

const idSchema = z.string().min(1);
const recordIdsSchema = z.array(idSchema);
const listMaterialsOptionsSchema = z
  .object({
    categoryId: idSchema.optional(),
    search: z.string().optional(),
    source: z.enum(["seed", "user"]).optional(),
  })
  .strict();
const listForRecordsSchema = z.object({ recordIds: recordIdsSchema }).strict();
const importExcelParamsSchema = z
  .object({
    filePath: idSchema,
    mode: z.literal("merge"),
  })
  .strict();

type PersistedCategory = ReturnType<StorageRepositories["materialCategories"]["upsert"]>;
type PersistedMaterial = ReturnType<StorageRepositories["materials"]["upsert"]>;
type PersistedAssignment = ReturnType<StorageRepositories["assignments"]["upsert"]>;
type ListMaterialsOptions = NonNullable<
  Parameters<StorageRepositories["materials"]["list"]>[0]
>;

export interface SeedIfEmptyResult {
  readonly seeded: boolean;
  readonly categoriesAdded: number;
  readonly materialsAdded: number;
  readonly dataVersion: string | null;
}

export interface ImportSummary {
  readonly categoriesAdded: number;
  readonly materialsAdded: number;
  readonly materialsUpdated: number;
  readonly untouched: number;
}

export interface MaterialsService {
  seedIfEmpty(): Promise<SeedIfEmptyResult>;
  listCategories(): readonly PersistedCategory[];
  upsertCategory(category: unknown): PersistedCategory;
  deleteCategory(id: unknown): boolean;
  listMaterials(options?: unknown): readonly PersistedMaterial[];
  upsertMaterial(material: unknown): PersistedMaterial;
  deleteMaterial(id: unknown): boolean;
  listAssignments(raw: unknown): readonly PersistedAssignment[];
  upsertAssignment(assignment: unknown): PersistedAssignment;
  deleteAssignment(id: unknown): boolean;
  importExcel(params: unknown): Promise<ImportSummary>;
}

function createDataVersion(): string {
  return `materials-${new Date().toISOString().slice(0, 10)}`;
}

function stripPersistenceTimestamps(item: unknown): unknown {
  if (item === null || typeof item !== "object") {
    return item;
  }

  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = item as {
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  return rest;
}

export function createMaterialsService(
  repos: StorageRepositories,
): MaterialsService {
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

  async function seedIfEmpty(): Promise<SeedIfEmptyResult> {
    const existingMaterials = repos.materials.list({});
    if (existingMaterials.length > 0) {
      return {
        seeded: false,
        categoriesAdded: 0,
        materialsAdded: 0,
        dataVersion: null,
      };
    }

    const seed = getMaterialSeed();

    const { categoriesAdded, materialsAdded } = repos.transaction(() => {
      let cats = 0;
      for (const category of seed.categories) {
        if (repos.materialCategories.getById(category.id) === null) {
          cats += 1;
        }
        repos.materialCategories.upsert(materialCategorySchema.parse(category));
      }

      let mats = 0;
      for (const material of seed.materials) {
        if (repos.materials.getById(material.id) === null) {
          mats += 1;
        }
        repos.materials.upsert(materialSchema.parse(material));
      }

      return { categoriesAdded: cats, materialsAdded: mats };
    });

    return {
      seeded: true,
      categoriesAdded,
      materialsAdded,
      dataVersion: seed.dataVersion,
    };
  }

  function listCategories(): readonly PersistedCategory[] {
    return repos.materialCategories.list();
  }

  function upsertCategory(category: unknown): PersistedCategory {
    return repos.materialCategories.upsert(
      materialCategorySchema.parse(stripPersistenceTimestamps(category)),
    );
  }

  function deleteCategory(id: unknown): boolean {
    return repos.materialCategories.delete(idSchema.parse(id));
  }

  function listMaterials(options?: unknown): readonly PersistedMaterial[] {
    if (options === undefined) {
      return repos.materials.list({});
    }

    const candidate = listMaterialsOptionsSchema.parse(options);
    const parsedOptions: ListMaterialsOptions = {
      ...(candidate.categoryId !== undefined
        ? { categoryId: candidate.categoryId }
        : {}),
      ...(candidate.search !== undefined ? { search: candidate.search } : {}),
      ...(candidate.source !== undefined ? { source: candidate.source } : {}),
    };
    return repos.materials.list(parsedOptions);
  }

  function upsertMaterial(material: unknown): PersistedMaterial {
    return repos.materials.upsert(
      materialSchema.parse(stripPersistenceTimestamps(material)),
    );
  }

  function deleteMaterial(id: unknown): boolean {
    return repos.materials.delete(idSchema.parse(id));
  }

  function listAssignments(raw: unknown): readonly PersistedAssignment[] {
    const { recordIds } = listForRecordsSchema.parse(raw);
    return repos.assignments.listForRecords(recordIds);
  }

  function upsertAssignment(assignment: unknown): PersistedAssignment {
    return repos.assignments.upsert(
      materialAssignmentSchema.parse(stripPersistenceTimestamps(assignment)),
    );
  }

  function deleteAssignment(id: unknown): boolean {
    return repos.assignments.delete(idSchema.parse(id));
  }

  async function importExcel(params: unknown): Promise<ImportSummary> {
    const parsedParams = importExcelParamsSchema.parse(params);
    const rows = readWorkbookRows(parsedParams.filePath);
    const parsedWorkbook = parseMaterialsWorkbook(rows, {
      dataVersion: createDataVersion(),
    });

    const existingMaterials = repos.materials.list({});
    const existingById = new Map(
      existingMaterials.map((material) => [material.id, material] as const),
    );
    const importedIds = new Set(parsedWorkbook.materials.map((material) => material.id));

    const { categoriesAdded, materialsAdded, materialsUpdated } = repos.transaction(() => {
      let cats = 0;
      for (const category of parsedWorkbook.categories) {
        if (repos.materialCategories.getById(category.id) === null) {
          cats += 1;
        }
        repos.materialCategories.upsert(materialCategorySchema.parse(category));
      }

      let mats = 0;
      let updated = 0;
      for (const material of parsedWorkbook.materials) {
        const parsedMaterial = materialSchema.parse(material);
        const current = existingById.get(parsedMaterial.id);

        if (current === undefined) {
          repos.materials.upsert(parsedMaterial);
          mats += 1;
          continue;
        }

        if (current.source === "user") {
          continue;
        }

        repos.materials.upsert(parsedMaterial);
        updated += 1;
      }

      return { categoriesAdded: cats, materialsAdded: mats, materialsUpdated: updated };
    });

    const untouched = existingMaterials.filter(
      (material) =>
        material.source === "user" ||
        (material.source === "seed" && !importedIds.has(material.id)),
    ).length;

    return {
      categoriesAdded,
      materialsAdded,
      materialsUpdated,
      untouched,
    };
  }
}
