export interface StandardSectionHintInput {
  currentA: number;
  rulerSectionMm2: number;
}

export interface StandardSectionHint {
  standardHintMm2: 2.5 | 4;
}

export function buildStandardSectionHint(
  input: StandardSectionHintInput,
): StandardSectionHint | null {
  const { currentA, rulerSectionMm2 } = input;

  if (!Number.isFinite(currentA) || currentA <= 0) {
    return null;
  }

  if (!Number.isFinite(rulerSectionMm2) || rulerSectionMm2 <= 0) {
    return null;
  }

  if (rulerSectionMm2 > 4) {
    return null;
  }

  const standardHintMm2 = currentA < 25 ? 2.5 : 4;

  // The hint is only surfaced when the standardized small-section recommendation
  // differs from the ruler-selected section.
  if (standardHintMm2 === rulerSectionMm2) {
    return null;
  }

  return { standardHintMm2 };
}
