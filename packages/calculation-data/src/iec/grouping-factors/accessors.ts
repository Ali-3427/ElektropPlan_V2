import { groupingFactorDataset } from "./dataset.js";

export function getGroupingFactor(circuits: number): number | undefined {
  return groupingFactorDataset.entries.find((entry) => entry.circuits === circuits)
    ?.factor;
}
