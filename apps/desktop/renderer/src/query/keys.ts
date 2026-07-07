export const queryKeys = {
  motorTable: ["motor-table"] as const,
  cableRulerTable: ["cable-ruler-table"] as const,
  vdProfiles: ["vd-profiles"] as const,
  vdDefaultProfile: ["vd-default-profile"] as const,
  installationMethods: ["installation-methods"] as const,
  engineVersion: ["engine-version"] as const,
  appVersion: ["app-version"] as const,
  records: (groupId?: string) =>
    ["records", groupId ?? "__all__"] as const,
  recordById: (id: string) => ["records", "by-id", id] as const,
  groups: ["groups"] as const,
  settings: ["settings"] as const,
  setting: (key: string) => ["settings", key] as const,
};
