import materialsJson from "./dataset.json" with { type: "json" };

import { loadJsonDataset } from "../load-json-dataset.js";
import type { MaterialDataset, MaterialSeed } from "./types.js";

const MATERIALS_DATASET_PATH =
  "packages/calculation-data/src/dataset/materials/dataset.json";

export const materialDataset: Readonly<MaterialDataset> = loadJsonDataset(
  materialsJson as MaterialDataset,
  MATERIALS_DATASET_PATH,
);

export function getMaterialSeed(): MaterialSeed {
  return {
    dataVersion: materialDataset.metadata.revision,
    categories: materialDataset.categories,
    materials: materialDataset.materials,
  };
}
