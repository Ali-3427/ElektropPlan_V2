import {
  getAmpacityForAmbient,
  getCableRulerDataVersion,
  getCableRulerEntries,
  type CableRulerEntry,
} from "@elektroplan/calculation-data";

export type CableRulerAmbient = "toprak_20C" | "hava_30C";

export interface CableRulerSelectionInput {
  designCurrentA: number;
  ambient: CableRulerAmbient;
}

export interface CableRulerSelection {
  selected: CableRulerEntry;
  selectedAmpacityA: number;
  dataVersion: string;
}

export function selectCableSectionFromRuler(
  input: CableRulerSelectionInput,
): CableRulerSelection {
  if (!Number.isFinite(input.designCurrentA) || input.designCurrentA <= 0) {
    throw new RangeError("designCurrentA must be a positive finite number.");
  }

  const sortedEntries = [...getCableRulerEntries()].sort(
    (left, right) => left.sectionMm2 - right.sectionMm2,
  );

  for (const entry of sortedEntries) {
    const ampacity = getAmpacityForAmbient(entry, input.ambient);
    if (ampacity !== null && ampacity >= input.designCurrentA) {
      return {
        selected: entry,
        selectedAmpacityA: ampacity,
        dataVersion: getCableRulerDataVersion(),
      };
    }
  }

  throw new RangeError(
    `No cable ruler row supports ${input.designCurrentA} A at ambient '${input.ambient}'.`,
  );
}
