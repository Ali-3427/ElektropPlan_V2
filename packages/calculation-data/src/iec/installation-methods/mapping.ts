import {
  INSTALLATION_METHOD_CODES,
  type InstallationMethodCode,
  type InstallationMethodDefinition,
} from "./types.js";

export const INSTALLATION_METHOD_MAP: Readonly<
  Record<InstallationMethodCode, InstallationMethodDefinition>
> = Object.freeze({
  A1: Object.freeze({ code: "A1" }),
  A2: Object.freeze({ code: "A2" }),
  B1: Object.freeze({ code: "B1" }),
  B2: Object.freeze({ code: "B2" }),
  C: Object.freeze({ code: "C" }),
  D: Object.freeze({ code: "D" }),
  E: Object.freeze({ code: "E" }),
});

export function isInstallationMethodCode(
  code: string,
): code is InstallationMethodCode {
  return (INSTALLATION_METHOD_CODES as readonly string[]).includes(code);
}

export function getInstallationMethodDefinition(
  code: string,
): InstallationMethodDefinition {
  if (!isInstallationMethodCode(code)) {
    throw new Error(`Unknown installation method code: ${code}`);
  }

  return INSTALLATION_METHOD_MAP[code];
}
