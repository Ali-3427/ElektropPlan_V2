import { SQRT3 } from "../common/constants/index.js";

const MAX_INFERRED_POLES = 24;
const RPM_PER_KILOWATT_TO_NEWTON_METER = 9550;

export function calcMotorInputPower(P_out: number, efficiencyPercent: number): number {
  return P_out / (efficiencyPercent / 100);
}

export function calcMotorApparentPower(inputPowerKW: number, cosPhi: number): number {
  return inputPowerKW / cosPhi;
}

export function calcDerivedCurrent(input: {
  P_out: number;
  phase: 1 | 3;
  voltage: number;
  cosPhi: number;
  efficiencyPercent: number;
}): number {
  const efficiency = input.efficiencyPercent / 100;

  if (input.phase === 1) {
    return (1000 * input.P_out) / (input.voltage * efficiency * input.cosPhi);
  }

  return (1000 * input.P_out) / (SQRT3 * input.voltage * efficiency * input.cosPhi);
}

export function calcSynchronousSpeedRpm(frequency: number, poles: number): number {
  return (120 * frequency) / poles;
}

export function calcSlipRatio(synchronousSpeedRpm: number, operatingSpeedRpm: number): number {
  return (synchronousSpeedRpm - operatingSpeedRpm) / synchronousSpeedRpm;
}

export function calcTorqueNm(powerKW: number, speedRpm: number): number {
  return (RPM_PER_KILOWATT_TO_NEWTON_METER * powerKW) / speedRpm;
}

export function isPoleCount(value: number): boolean {
  return Number.isInteger(value) && value >= 2 && value <= MAX_INFERRED_POLES && value % 2 === 0;
}

export function inferPoleCountFromRpm(frequency: number, ratedSpeedRpm: number): number {
  let selectedPoleCount: number | undefined;
  let smallestPositiveDelta = Number.POSITIVE_INFINITY;

  for (let poles = 2; poles <= MAX_INFERRED_POLES; poles += 2) {
    const synchronousSpeedRpm = calcSynchronousSpeedRpm(frequency, poles);
    const delta = synchronousSpeedRpm - ratedSpeedRpm;

    if (delta <= 0 || delta >= smallestPositiveDelta) {
      continue;
    }

    smallestPositiveDelta = delta;
    selectedPoleCount = poles;
  }

  if (selectedPoleCount === undefined) {
    throw new RangeError(
      `polesOrRpm=${ratedSpeedRpm} cannot be resolved to a valid pole count at ${frequency} Hz.`,
    );
  }

  return selectedPoleCount;
}
