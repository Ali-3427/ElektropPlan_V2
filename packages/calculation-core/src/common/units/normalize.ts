import { HP_TO_KW } from "../constants/index.js";

export function hpToKw(hp: number): number {
  return hp * HP_TO_KW;
}
