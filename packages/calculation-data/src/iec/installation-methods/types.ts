export const INSTALLATION_METHOD_CODES = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C",
  "D",
  "E",
] as const;

export type InstallationMethodCode = (typeof INSTALLATION_METHOD_CODES)[number];

export interface InstallationMethodDefinition {
  code: InstallationMethodCode;
}
