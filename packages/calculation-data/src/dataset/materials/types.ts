import type { Material, MaterialCategory } from "@elektroplan/contracts";

import type { DatasetWithMetadata } from "../types.js";

export interface MaterialDataset extends DatasetWithMetadata {
  readonly categories: readonly MaterialCategory[];
  readonly materials: readonly Material[];
}

export interface MaterialSeed {
  readonly dataVersion: string;
  readonly categories: readonly MaterialCategory[];
  readonly materials: readonly Material[];
}
