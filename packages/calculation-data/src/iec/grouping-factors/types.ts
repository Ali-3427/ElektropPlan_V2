import type { DatasetWithMetadata } from "../../dataset/types.js";

export interface GroupingFactorEntry {
  circuits: number;
  factor: number;
}

export interface GroupingFactorDataset extends DatasetWithMetadata {
  entries: readonly GroupingFactorEntry[];
}
