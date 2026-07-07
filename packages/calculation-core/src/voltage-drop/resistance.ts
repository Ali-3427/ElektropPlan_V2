export function calcR20(
  resistivityOhmMm2PerM: number,
  sectionMm2: number,
): number {
  return (resistivityOhmMm2PerM * 1000) / sectionMm2;
}

export function calcRTheta(
  resistance20OhmPerKm: number,
  alpha20: number,
  conductorTempC: number,
): number {
  return resistance20OhmPerKm * (1 + alpha20 * (conductorTempC - 20));
}
