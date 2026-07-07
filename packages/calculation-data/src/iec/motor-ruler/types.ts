import type { DatasetWithMetadata } from "../../dataset/types.js";

export type MotorTableVoltage = 220 | 380;

export interface MotorTableEntry {
  kW: number;
  PS: number;
  cosPhi: number;
  efficiencyPercent: number;
  currentA_220V: number;
  currentA_380V: number | null;
  cableSpec: string;
}

export const MOTOR_TABLE_COLUMNS = [
  "kW",
  "PS",
  "cosPhi",
  "efficiencyPercent",
  "currentA_220V",
  "currentA_380V",
  "cableSpec",
] as const;

export type MotorTableColumn = (typeof MOTOR_TABLE_COLUMNS)[number];

export interface MotorTableDataset extends DatasetWithMetadata {
  columns: readonly MotorTableColumn[];
  entries: readonly MotorTableEntry[];
}
