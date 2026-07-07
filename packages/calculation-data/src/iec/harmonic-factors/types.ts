import type { DatasetWithMetadata } from "../../dataset/types.js";

export type HarmonicSizingCurrentBasis = "phase" | "neutral";

export interface HarmonicFactorRange {
  minPercent: number;
  maxPercent: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
}

export interface HarmonicFactorEntry {
  range: HarmonicFactorRange;
  phaseFactor: number | null;
  neutralFactor: number | null;
  sizingCurrentBasis: HarmonicSizingCurrentBasis;
}

export interface HarmonicFactorDataset extends DatasetWithMetadata {
  entries: readonly HarmonicFactorEntry[];
}

export interface HarmonicFactorResult {
  thirdHarmonicPercent: number;
  factor: number;
  appliedTo: HarmonicSizingCurrentBasis;
  sizingCurrentBasis: HarmonicSizingCurrentBasis;
  phaseFactor: number | null;
  neutralFactor: number | null;
  neutralCurrentMultiplier: number | null;
}
