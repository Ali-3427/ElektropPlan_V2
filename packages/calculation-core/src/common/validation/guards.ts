export function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number.`);
  }
}

export function assertInRange(
  value: number,
  min: number,
  max: number,
  name: string
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
}

export function assertOneOf<T extends string | number>(
  value: T,
  allowedValues: readonly T[],
  name: string
): void {
  if (!allowedValues.includes(value)) {
    throw new RangeError(
      `${name} must be one of: ${allowedValues.join(", ")}.`
    );
  }
}
