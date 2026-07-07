import {
  ampacityDatasets,
  getAmpacity,
  getInstallationMethodDefinition,
  getStandardCrossSections,
  groupingFactorDataset,
  harmonicFactorDataset,
  isInstallationMethodCode,
  temperatureFactorDataset,
  type HarmonicFactorResult,
} from "@elektroplan/calculation-data";

import { assertOneOf, assertPositive } from "../common/validation/guards.js";
import { calculateVoltageDrop } from "../voltage-drop/index.js";
import {
  lookupGroupingFactor,
  lookupHarmonicFactor,
  lookupTempFactor,
} from "./correction-factors.js";
import { calculatePreliminaryCableEstimate } from "./preliminary-estimate.js";
import {
  CABLE_INSTALLATION_METHODS,
  type CableInstallationMethod,
  type CablePhase,
  type CableSizingInput,
  type CableSizingOutput,
  type CandidateStep,
} from "./types.js";

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer.`);
  }
}

function validateCableSizingInput(input: CableSizingInput): void {
  assertPositive(input.designCurrentA, "designCurrentA");
  assertOneOf(input.phase, [1, 3] as const, "phase");

  if (!isInstallationMethodCode(input.installationMethod)) {
    throw new RangeError(
      `installationMethod must be one of: ${CABLE_INSTALLATION_METHODS.join(", ")}.`,
    );
  }

  getInstallationMethodDefinition(input.installationMethod);

  assertPositive(input.ambientTemperatureC, "ambientTemperatureC");
  assertPositive(input.groupedCircuits, "groupedCircuits");
  assertInteger(input.groupedCircuits, "groupedCircuits");

  if (!Number.isFinite(input.thirdHarmonicPercent) || input.thirdHarmonicPercent < 0) {
    throw new RangeError("thirdHarmonicPercent must be greater than or equal to 0.");
  }

  assertPositive(input.voltageDropLimitPercent, "voltageDropLimitPercent");

  if (input.extraCorrectionFactor !== undefined) {
    assertPositive(input.extraCorrectionFactor, "extraCorrectionFactor");
  }

  if (
    input.phase === 1 &&
    input.voltageDrop.systemType !== "single-phase-ac-two-conductor"
  ) {
    throw new RangeError(
      "phase 1 cable sizing requires voltageDrop.systemType 'single-phase-ac-two-conductor'.",
    );
  }

  if (
    input.phase === 3 &&
    input.voltageDrop.systemType === "single-phase-ac-two-conductor"
  ) {
    throw new RangeError(
      "phase 3 cable sizing requires a three-phase voltage-drop systemType.",
    );
  }
}

export function determineLoadedConductors(
  phase: CablePhase,
  _installationMethod: CableInstallationMethod,
): number {
  return phase === 3 ? 3 : 2;
}

function getSizingCurrent(
  designCurrentA: number,
  harmonicFactor: HarmonicFactorResult,
): number {
  if (
    harmonicFactor.sizingCurrentBasis === "neutral" &&
    harmonicFactor.neutralCurrentMultiplier !== null
  ) {
    return designCurrentA * harmonicFactor.neutralCurrentMultiplier;
  }

  return designCurrentA;
}

function assertSupportedLoadedConductors(loadedConductors: number): void {
  if (loadedConductors === 3) {
    return;
  }

  if (loadedConductors === 2) {
    throw new RangeError(
      "Single-phase cable sizing is not yet supported because the authoritative ampacity dataset only covers 3 loaded conductors.",
    );
  }

  throw new RangeError(
    `No authoritative ampacity dataset is available for ${loadedConductors} loaded conductors.`,
  );
}

function createDataVersion(material: CableSizingInput["conductorMaterial"]): string {
  return [
    `${ampacityDatasets[material].metadata.id}:${ampacityDatasets[material].metadata.revision}`,
    `${temperatureFactorDataset.metadata.id}:${temperatureFactorDataset.metadata.revision}`,
    `${groupingFactorDataset.metadata.id}:${groupingFactorDataset.metadata.revision}`,
    `${harmonicFactorDataset.metadata.id}:${harmonicFactorDataset.metadata.revision}`,
  ].join("|");
}

export function calculateCableSizingAlgorithm(
  input: CableSizingInput,
): {
  value: CableSizingOutput;
  warnings: [];
  assumptions: CableSizingOutput["vdResult"]["assumptions"];
  formulaVariant: "cable-sizing-ascending-scan";
  dataVersion: string;
} {
  validateCableSizingInput(input);

  const loadedConductors = determineLoadedConductors(
    input.phase,
    input.installationMethod,
  );

  assertSupportedLoadedConductors(loadedConductors);

  const kT = lookupTempFactor({
    installationMethod: input.installationMethod,
    ambientTemperatureC: input.ambientTemperatureC,
    insulationRating: input.insulationRating,
  });
  const kG = lookupGroupingFactor(input.groupedCircuits);
  const harmonicFactor = lookupHarmonicFactor(input.thirdHarmonicPercent);
  const kH = harmonicFactor.factor;
  const extraCorrectionFactor = input.extraCorrectionFactor ?? 1;
  const kTotal = kT * kG * kH * extraCorrectionFactor;
  const sizingCurrentA = getSizingCurrent(input.designCurrentA, harmonicFactor);
  const izRequiredA = sizingCurrentA / kTotal;
  const preliminaryEstimate = calculatePreliminaryCableEstimate({
    referenceCurrentA: sizingCurrentA,
    conductorMaterial: input.conductorMaterial,
    correctionFactorProduct: kTotal,
  });

  const candidateTrace: CandidateStep[] = [];
  const candidateSections = getStandardCrossSections(input.conductorMaterial);

  for (const sectionMm2 of candidateSections) {
    const baseAmpacity = getAmpacity({
      material: input.conductorMaterial,
      crossSectionMm2: sectionMm2,
      method: input.installationMethod,
    });
    const correctedAmpacityA =
      typeof baseAmpacity === "number" ? baseAmpacity * kTotal : null;
    const thermalPass =
      typeof baseAmpacity === "number" && baseAmpacity >= izRequiredA;
    const vdResult = calculateVoltageDrop({
      ...input.voltageDrop,
      mode: "current",
      currentA: input.designCurrentA,
      sectionMm2,
      conductorMaterial: input.conductorMaterial,
    });
    const vdPass =
      vdResult.value.deltaVPercent <= input.voltageDropLimitPercent;
    const accepted = thermalPass && vdPass;

    candidateTrace.push({
      sectionMm2,
      baseAmpacityA: typeof baseAmpacity === "number" ? baseAmpacity : null,
      correctedAmpacityA,
      thermalPass,
      vdPass,
      accepted,
      vdResult,
    });

    if (accepted) {
      return {
        value: {
          selectedSectionMm2: sectionMm2,
          baseAmpacityA: baseAmpacity,
          correctedAmpacityA: correctedAmpacityA ?? 0,
          designCurrentA: input.designCurrentA,
          sizingCurrentA,
          loadedConductors,
          harmonicSizingBasis: harmonicFactor.sizingCurrentBasis,
          kT,
          kG,
          kH,
          kTotal,
          izRequiredA,
          voltageDropLimitPercent: input.voltageDropLimitPercent,
          preliminaryEstimate,
          vdResult,
          candidateTrace,
        },
        warnings: [],
        assumptions: vdResult.assumptions,
        formulaVariant: "cable-sizing-ascending-scan",
        dataVersion: createDataVersion(input.conductorMaterial),
      };
    }
  }

  throw new RangeError("No cable cross-section satisfies both thermal and voltage-drop requirements.");
}
