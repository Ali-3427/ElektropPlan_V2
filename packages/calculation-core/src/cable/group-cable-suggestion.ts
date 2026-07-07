import type { CableRulerAmbient } from "./ruler.js";
import { selectCableSectionFromRuler } from "./ruler.js";
import { buildStandardSectionHint } from "./standard-section-hint.js";

export interface GroupCableSuggestionInput {
  groupTotalCurrentA: number;
}

export interface GroupCableSuggestionEntry {
  sectionMm2: number;
  label: string;
  ambient: CableRulerAmbient;
  ampacityA: number;
  standardHintMm2?: 2.5 | 4;
}

export interface GroupCableSuggestionResult {
  toprak_20C: GroupCableSuggestionEntry | null;
  hava_30C: GroupCableSuggestionEntry | null;
}

function buildAmbientSuggestion(
  groupTotalCurrentA: number,
  ambient: CableRulerAmbient,
): GroupCableSuggestionEntry {
  const selection = selectCableSectionFromRuler({
    designCurrentA: groupTotalCurrentA,
    ambient,
  });
  const hint = buildStandardSectionHint({
    currentA: groupTotalCurrentA,
    rulerSectionMm2: selection.selected.sectionMm2,
  });

  return {
    sectionMm2: selection.selected.sectionMm2,
    label: selection.selected.nominal_kesit_mm2,
    ambient,
    ampacityA: selection.selectedAmpacityA,
    ...(hint === null ? {} : hint),
  };
}

function buildAmbientSuggestionSafely(
  groupTotalCurrentA: number,
  ambient: CableRulerAmbient,
): GroupCableSuggestionEntry | null {
  try {
    return buildAmbientSuggestion(groupTotalCurrentA, ambient);
  } catch {
    return null;
  }
}

export function suggestGroupCableSections(
  input: GroupCableSuggestionInput,
): GroupCableSuggestionResult {
  const { groupTotalCurrentA } = input;

  if (!Number.isFinite(groupTotalCurrentA) || groupTotalCurrentA <= 0) {
    return {
      toprak_20C: null,
      hava_30C: null,
    };
  }

  return {
    toprak_20C: buildAmbientSuggestionSafely(groupTotalCurrentA, "toprak_20C"),
    hava_30C: buildAmbientSuggestionSafely(groupTotalCurrentA, "hava_30C"),
  };
}
