import {
  getGroupingFactor,
  getHarmonicFactor,
  getTempFactor,
  type HarmonicFactorResult,
  type InstallationMethodCode,
  type InsulationRating,
} from "@elektroplan/calculation-data";

export interface TempFactorLookupInput {
  installationMethod: InstallationMethodCode;
  ambientTemperatureC: number;
  insulationRating: InsulationRating;
}

export function lookupTempFactor(input: TempFactorLookupInput): number {
  const factor = getTempFactor({
    method: input.installationMethod,
    temperatureC: input.ambientTemperatureC,
    insulation: input.insulationRating,
  });

  if (factor === undefined) {
    throw new RangeError(
      `No temperature factor found for method ${input.installationMethod} at ${input.ambientTemperatureC} C.`,
    );
  }

  return factor;
}

export function lookupGroupingFactor(groupedCircuits: number): number {
  const factor = getGroupingFactor(groupedCircuits);

  if (factor === undefined) {
    throw new RangeError(
      `No grouping factor found for ${groupedCircuits} grouped circuits.`,
    );
  }

  return factor;
}

export function lookupHarmonicFactor(
  thirdHarmonicPercent: number,
): HarmonicFactorResult {
  const factor = getHarmonicFactor(thirdHarmonicPercent);

  if (factor === undefined) {
    throw new RangeError(
      `No harmonic factor found for third harmonic content ${thirdHarmonicPercent}%.`,
    );
  }

  return factor;
}
