export function roundForDisplay(value: number, fractionDigits = 2): number {
  const factor = 10 ** fractionDigits;

  return Math.round(value * factor) / factor;
}
