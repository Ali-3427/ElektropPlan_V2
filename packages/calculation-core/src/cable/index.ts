import type { CableSizingResult } from "./types.js";
import { calculateCableSizingAlgorithm } from "./algorithm.js";
import type { CableSizingInput } from "./types.js";
import { ENGINE_VERSION } from "../version.js";

export function calculateCableSizing(input: CableSizingInput): CableSizingResult {
  const result = calculateCableSizingAlgorithm(input);

  return {
    ...result,
    engineVersion: ENGINE_VERSION,
  };
}

export {
  calculateCableSizingAlgorithm,
  determineLoadedConductors,
} from "./algorithm.js";
export { selectCableSectionFromRuler } from "./ruler.js";
export {
  lookupGroupingFactor,
  lookupHarmonicFactor,
  lookupTempFactor,
} from "./correction-factors.js";
export {
  calculatePreliminaryCableEstimate,
} from "./preliminary-estimate.js";
export { buildStandardSectionHint } from "./standard-section-hint.js";
export { suggestGroupCableSections } from "./group-cable-suggestion.js";
export type {
  CableRulerAmbient,
  CableRulerSelection,
  CableRulerSelectionInput,
} from "./ruler.js";
export type {
  GroupCableSuggestionEntry,
  GroupCableSuggestionInput,
  GroupCableSuggestionResult,
} from "./group-cable-suggestion.js";
export type {
  StandardSectionHint,
  StandardSectionHintInput,
} from "./standard-section-hint.js";
export type {
  CableInstallationMethod,
  CablePhase,
  CableSizingInput,
  CableSizingOutput,
  CableSizingResult,
  CableVoltageDropInput,
  CandidateStep,
} from "./types.js";
export { CABLE_INSTALLATION_METHODS } from "./types.js";
