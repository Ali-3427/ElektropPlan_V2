import type { DatasetWithMetadata } from "../../dataset/types.js";

export type VoltageDropProfileId =
  | "lighting-3pct"
  | "power-5pct"
  | "motor-feeder-5pct"
  | "total-installation-4pct";

export interface VoltageDropProfile {
  id: VoltageDropProfileId;
  titleKey: string;
  titleTr: string;
  limitPercent: number;
}

export interface VoltageDropProfilesDataset extends DatasetWithMetadata {
  defaultProfileId: VoltageDropProfileId;
  profiles: readonly VoltageDropProfile[];
}

export const VOLTAGE_DROP_PROFILE_IDS: readonly VoltageDropProfileId[] = [
  "lighting-3pct",
  "power-5pct",
  "motor-feeder-5pct",
  "total-installation-4pct",
];
