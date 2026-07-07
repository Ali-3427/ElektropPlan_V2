import { SQRT3 } from "../common/constants/index.js";

export function calcSinglePhaseACTwoConductorVoltageDrop(
  currentA: number,
  lengthM: number,
  resistanceOhmPerKm: number,
  reactanceOhmPerKm: number,
  cosPhi: number,
  sinPhi: number,
): number {
  return (
    2 *
    currentA *
    (lengthM / 1000) *
    (resistanceOhmPerKm * cosPhi + reactanceOhmPerKm * sinPhi)
  );
}

export function calcDCTwoConductorVoltageDrop(
  currentA: number,
  lengthM: number,
  resistanceOhmPerKm: number,
): number {
  return 2 * currentA * (lengthM / 1000) * resistanceOhmPerKm;
}

export function calcThreePhaseACLineLineVoltageDrop(
  currentA: number,
  lengthM: number,
  resistanceOhmPerKm: number,
  reactanceOhmPerKm: number,
  cosPhi: number,
  sinPhi: number,
): number {
  return (
    SQRT3 *
    currentA *
    (lengthM / 1000) *
    (resistanceOhmPerKm * cosPhi + reactanceOhmPerKm * sinPhi)
  );
}

export function calcThreePhaseACLineNeutralVoltageDrop(
  currentA: number,
  lengthM: number,
  resistanceOhmPerKm: number,
  reactanceOhmPerKm: number,
  cosPhi: number,
  sinPhi: number,
): number {
  return (
    currentA *
    (lengthM / 1000) *
    (resistanceOhmPerKm * cosPhi + reactanceOhmPerKm * sinPhi)
  );
}
