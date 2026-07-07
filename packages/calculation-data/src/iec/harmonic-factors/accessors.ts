import { harmonicFactorDataset } from "./dataset.js";
import type {
  HarmonicFactorEntry,
  HarmonicFactorResult,
} from "./types.js";

function normalizeDecimal(value: number): number {
  return Number(value.toFixed(12));
}

function isWithinRange(
  value: number,
  entry: HarmonicFactorEntry,
): boolean {
  const {
    minPercent,
    maxPercent,
    minInclusive,
    maxInclusive,
  } = entry.range;

  const lowerBoundPass = minInclusive ? value >= minPercent : value > minPercent;
  const upperBoundPass =
    maxPercent === null
      ? true
      : maxInclusive
        ? value <= maxPercent
        : value < maxPercent;

  return lowerBoundPass && upperBoundPass;
}

export function getHarmonicFactor(
  thirdHarmonicPercent: number,
): HarmonicFactorResult | undefined {
  if (thirdHarmonicPercent < 0) {
    throw new Error(`thirdHarmonicPercent must be >= 0.`);
  }

  const entry = harmonicFactorDataset.entries.find((candidate) =>
    isWithinRange(thirdHarmonicPercent, candidate),
  );

  if (entry === undefined) {
    return undefined;
  }

  const factor =
    entry.sizingCurrentBasis === "phase"
      ? entry.phaseFactor
      : entry.neutralFactor;

  if (factor === null) {
    throw new Error(`Authoritative harmonic dataset returned a null factor for the selected basis.`);
  }

  return {
    thirdHarmonicPercent,
    factor,
    appliedTo: entry.sizingCurrentBasis,
    sizingCurrentBasis: entry.sizingCurrentBasis,
    phaseFactor: entry.phaseFactor,
    neutralFactor: entry.neutralFactor,
    neutralCurrentMultiplier:
      entry.sizingCurrentBasis === "neutral"
        ? normalizeDecimal((thirdHarmonicPercent / 100) * 3)
        : null,
  };
}
