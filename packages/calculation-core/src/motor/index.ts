import {
  getAmpacityForAmbient,
  getCableRulerEntries,
} from "@elektroplan/calculation-data";

import { buildStandardSectionHint } from "../cable/standard-section-hint.js";
import type { FormulaModeOutput, MotorCurrentResult } from "./types.js";
import { calculateMotorFormula } from "./formulas.js";
import { getMotorTableDataVersion, calculateMotorFromTable } from "./table-mode.js";
import type { MotorCurrentInput } from "./types.js";
import { validateMotorCurrentInput } from "./validate.js";
import { ENGINE_VERSION } from "../version.js";
const FORMULA_MODE_DATA_VERSION = "motor-formula-v1";

export function calculateMotorCurrent(input: MotorCurrentInput): MotorCurrentResult {
  validateMotorCurrentInput(input);

  if (input.mode === "table") {
    const result = calculateMotorFromTable(input);

    return {
      ...result,
      warnings: [],
      dataVersion: getMotorTableDataVersion(),
      engineVersion: ENGINE_VERSION,
    };
  }

  const { P_out, voltage, cosPhi, efficiencyPercent } = input;

  if (
    P_out === undefined ||
    voltage === undefined ||
    cosPhi === undefined ||
    efficiencyPercent === undefined
  ) {
    throw new RangeError("Formula mode input was not fully validated.");
  }

  const result = calculateMotorFormula({
    phase: input.phase,
    P_out,
    voltage,
    cosPhi,
    efficiencyPercent,
    ...(input.phase === 3 ? { voltageMode: input.voltageMode } : {}),
  });

  let suggestedCableSection: FormulaModeOutput["suggestedCableSection"];

  const suggestedEntry = getCableRulerEntries()
    .filter((entry) => entry.sectionMm2 >= 1.5)
    .sort((left, right) => left.sectionMm2 - right.sectionMm2)
    .find((entry) => {
      const ampacity = getAmpacityForAmbient(entry, "hava_30C");
      return ampacity !== null && ampacity >= result.value.currentA;
    });

  if (suggestedEntry !== undefined) {
    const ampacity = getAmpacityForAmbient(suggestedEntry, "hava_30C");

    if (ampacity === null) {
      throw new RangeError("Motor cable suggestion requires an air ampacity.");
    }

    const standardSectionHint = buildStandardSectionHint({
      currentA: result.value.currentA,
      rulerSectionMm2: suggestedEntry.sectionMm2,
    });

    suggestedCableSection = {
      sectionMm2: suggestedEntry.sectionMm2,
      label: suggestedEntry.nominal_kesit_mm2,
      ambient: "hava_30C" as const,
      ampacityA: ampacity,
      ...(standardSectionHint === null ? {} : standardSectionHint),
    };
  } else {
    suggestedCableSection = undefined;
  }

  return {
    ...result,
    value: {
      ...result.value,
      ...(suggestedCableSection === undefined
        ? {}
        : { suggestedCableSection }),
    },
    warnings: [],
    assumptions: [],
    dataVersion: FORMULA_MODE_DATA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}

export type {
  FormulaModeInput,
  FormulaModeOutput,
  MotorCurrentInput,
  MotorCurrentMode,
  MotorCurrentOutput,
  MotorCurrentResult,
  MotorPhase,
  MotorSuggestedCableSection,
  MotorSuggestedCableSectionAmbient,
  MotorTableVoltage,
  MotorVoltageMode,
  TableModeInput,
  TableModeOutput,
} from "./types.js";
export { validateMotorCurrentInput } from "./validate.js";
export {
  calcApparentPower,
  calcInputPower,
  calcSinglePhaseCurrent,
  calcThreePhaseLineLineCurrent,
  calcThreePhaseLineNeutralCurrent,
} from "./formulas.js";
export { calculateMotorFromTable, getMotorTableDataVersion } from "./table-mode.js";
