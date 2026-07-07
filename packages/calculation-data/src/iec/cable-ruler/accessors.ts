import { cableRulerDataset } from "./dataset.js";
import type { CableRulerAmbient, CableRulerEntry } from "./types.js";

export function getCableRulerEntries(): readonly CableRulerEntry[] {
  return cableRulerDataset.entries;
}

export function getCableRulerDataVersion(): string {
  return `${cableRulerDataset.metadata.id}:${cableRulerDataset.metadata.revision}`;
}

export function getAmpacityForAmbient(
  entry: CableRulerEntry,
  ambient: CableRulerAmbient,
): number | null {
  return ambient === "toprak_20C" ? entry.akim_toprak_20C_A : entry.akim_hava_30C_A;
}
