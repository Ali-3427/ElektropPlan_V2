import type { InstallationMethodCode } from "../installation-methods/types.js";
import { temperatureFactorDataset } from "./dataset.js";
import type {
  InsulationRating,
  TempFactorQuery,
  TemperatureFactorEntry,
  TemperatureFactorEnvironment,
} from "./types.js";

export function getTemperatureFactorEnvironmentForMethod(
  method: InstallationMethodCode,
): TemperatureFactorEnvironment {
  return method === "D" ? "underground" : "air";
}

function readFactor(
  entry: TemperatureFactorEntry,
  insulation: InsulationRating,
): number {
  return insulation === "PVC_70C" ? entry.pvc70 : entry.xlpeEpr90;
}

export function getTempFactor({
  method,
  temperatureC,
  insulation,
}: TempFactorQuery): number | undefined {
  const environment = getTemperatureFactorEnvironmentForMethod(method);
  const table = temperatureFactorDataset[environment];
  const entry = table.find((candidate) => candidate.temperatureC === temperatureC);

  if (entry === undefined) {
    return undefined;
  }

  return readFactor(entry, insulation);
}
