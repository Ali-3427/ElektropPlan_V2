import { motorTableDataset } from "./dataset.js";
import type { MotorTableEntry, MotorTableVoltage } from "./types.js";

export function getMotorTableEntries(): readonly MotorTableEntry[] {
  return motorTableDataset.entries;
}

export function getMotorTableEntryByKW(
  kW: number,
): MotorTableEntry | undefined {
  return motorTableDataset.entries.find((entry) => entry.kW === kW);
}

export function isVoltageAvailable(
  entry: MotorTableEntry,
  voltage: MotorTableVoltage,
): boolean {
  return voltage === 220 ? true : entry.currentA_380V !== null;
}
