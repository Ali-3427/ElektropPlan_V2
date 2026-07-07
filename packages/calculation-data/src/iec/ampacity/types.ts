import type { DatasetWithMetadata } from "../../dataset/types.js";
import type { InstallationMethodCode } from "../installation-methods/types.js";

export const AMPACITY_MATERIALS = ["copper", "aluminum"] as const;

export type AmpacityMaterial = (typeof AMPACITY_MATERIALS)[number];
export type AmpacityValue = number | null;

export interface AmpacityEntry {
  crossSectionMm2: number;
  methods: Readonly<Record<InstallationMethodCode, AmpacityValue>>;
}

export interface AmpacityDataset extends DatasetWithMetadata {
  material: AmpacityMaterial;
  conductorCount: 3;
  system: "three-phase";
  insulation: "XLPE/EPR";
  insulationTemperatureC: 90;
  referenceAmbientAirC: 30;
  referenceGroundC: 20;
  entries: readonly AmpacityEntry[];
}

export interface AmpacityQuery {
  material: AmpacityMaterial;
  crossSectionMm2: number;
  method: InstallationMethodCode;
}
