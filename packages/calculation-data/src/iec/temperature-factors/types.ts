import type { DatasetWithMetadata } from "../../dataset/types.js";
import type { InstallationMethodCode } from "../installation-methods/types.js";

export const INSULATION_RATINGS = ["PVC_70C", "XLPE_EPR_90C"] as const;
export const TEMPERATURE_FACTOR_ENVIRONMENTS = ["air", "underground"] as const;

export type InsulationRating = (typeof INSULATION_RATINGS)[number];
export type TemperatureFactorEnvironment =
  (typeof TEMPERATURE_FACTOR_ENVIRONMENTS)[number];

export interface TemperatureFactorEntry {
  temperatureC: number;
  pvc70: number;
  xlpeEpr90: number;
}

export interface TemperatureFactorDataset extends DatasetWithMetadata {
  air: readonly TemperatureFactorEntry[];
  underground: readonly TemperatureFactorEntry[];
}

export interface TempFactorQuery {
  method: InstallationMethodCode;
  temperatureC: number;
  insulation: InsulationRating;
}
