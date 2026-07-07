import type { InstallationMethodCode } from "../installation-methods/types.js";
import {
  ampacityDatasets,
  standardCrossSectionsByMaterial,
} from "./dataset.js";
import type { AmpacityMaterial, AmpacityQuery, AmpacityValue } from "./types.js";

export function getStandardCrossSections(
  material: AmpacityMaterial,
): readonly number[] {
  return standardCrossSectionsByMaterial[material];
}

export function getAmpacity({
  material,
  crossSectionMm2,
  method,
}: AmpacityQuery): AmpacityValue | undefined {
  const entry = ampacityDatasets[material].entries.find(
    (candidate) => candidate.crossSectionMm2 === crossSectionMm2,
  );

  if (entry === undefined) {
    return undefined;
  }

  return entry.methods[method];
}

export function hasAmpacityValue(
  material: AmpacityMaterial,
  crossSectionMm2: number,
  method: InstallationMethodCode,
): boolean {
  return typeof getAmpacity({ material, crossSectionMm2, method }) === "number";
}
