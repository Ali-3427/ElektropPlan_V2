import { voltageDropProfilesDataset } from "./dataset.js";
import type { VoltageDropProfile, VoltageDropProfileId } from "./types.js";

export function getVoltageDropProfiles(): readonly VoltageDropProfile[] {
  return voltageDropProfilesDataset.profiles;
}

export function getDefaultProfile(): VoltageDropProfile {
  const id = voltageDropProfilesDataset.defaultProfileId;
  const profile = voltageDropProfilesDataset.profiles.find((p) => p.id === id);
  if (!profile) {
    throw new Error(`Default VD profile '${id}' not found.`);
  }
  return profile;
}

export function getProfileById(
  id: VoltageDropProfileId | string,
): VoltageDropProfile | undefined {
  return voltageDropProfilesDataset.profiles.find((p) => p.id === id);
}

export function getVoltageDropDataVersion(): string {
  return voltageDropProfilesDataset.metadata.revision;
}
