import type { ElektroPlanBridge } from "./types";

export function isBridgeAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.elektroPlan !== "undefined";
}

export function getBridge(): ElektroPlanBridge {
  if (!isBridgeAvailable()) {
    throw new Error(
      "ElektroPlan bridge not available. Launch via Electron.",
    );
  }
  return window.elektroPlan as ElektroPlanBridge;
}
