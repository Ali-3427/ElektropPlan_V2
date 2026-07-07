export {
  getDefaultProfile,
  getProfileById,
  getVoltageDropDataVersion,
  getVoltageDropProfiles,
} from "./accessors.js";
export { voltageDropProfilesDataset } from "./dataset.js";
export {
  VOLTAGE_DROP_PROFILE_IDS,
  type VoltageDropProfile,
  type VoltageDropProfileId,
  type VoltageDropProfilesDataset,
} from "./types.js";

// Retained for backward-compat readers referencing prior placeholder.
export const VOLTAGE_DROP_LIMITS_DATASET_STATUS = "authoritative-v1";
