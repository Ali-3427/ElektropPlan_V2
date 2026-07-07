import type { VoltageDropGroupResolvedSettings, VoltageDropGroupSettingsInput } from "./types.js";

export const VOLTAGE_DROP_GROUP_DATA_VERSION = "voltage-drop-group-radial-v2";

export const DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS = {
  limitPercent: 3,
  phaseMode: "three-phase",
  singlePhaseVoltageV: 230,
  threePhaseVoltageV: 400,
  cosPhi: 0.8,
  efficiencyPercent: 100,
  conductorMaterial: "copper",
  installationMethod: "C",
  insulationRating: "XLPE_EPR_90C",
  ambientTemperatureC: 30,
  groupedCircuits: 1,
  thirdHarmonicPercent: 0,
  conductorTempC: 70,
  impedanceMode: "simplified",
  terminalLossFactor: 1.015,
} as const;

export function resolveVoltageDropGroupSettings(
  settings: VoltageDropGroupSettingsInput | undefined,
  totalLocalPowerKW: number,
): VoltageDropGroupResolvedSettings {
  const merged = {
    ...DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS,
    ...(settings ?? {}),
  };
  const phaseMode = merged.phaseMode === "auto" ? "three-phase" : merged.phaseMode;
  const systemType =
    phaseMode === "three-phase"
      ? "three-phase-ac-ll"
      : "single-phase-ac-two-conductor";

  return {
    limitPercent: merged.limitPercent,
    phaseMode,
    systemType,
    baseVoltageV:
      systemType === "three-phase-ac-ll" ? merged.threePhaseVoltageV : merged.singlePhaseVoltageV,
    cosPhi: merged.cosPhi,
    efficiencyPercent: merged.efficiencyPercent,
    conductorMaterial: merged.conductorMaterial,
    installationMethod: merged.installationMethod,
    insulationRating: merged.insulationRating,
    ambientTemperatureC: merged.ambientTemperatureC,
    groupedCircuits: merged.groupedCircuits,
    thirdHarmonicPercent: merged.thirdHarmonicPercent,
    conductorTempC: merged.conductorTempC,
    impedanceMode: merged.impedanceMode,
    ...(merged.reactanceOhmPerKm === undefined ? {} : { reactanceOhmPerKm: merged.reactanceOhmPerKm }),
    terminalLossFactor: merged.terminalLossFactor,
  };
}
