export function calcSinPhi(cosPhi: number): number {
  return Math.sqrt(Math.max(0, 1 - cosPhi ** 2));
}
