import {
  getMotorTableEntryByKW,
  isVoltageAvailable,
  motorTableDataset,
} from "@elektroplan/calculation-data";

import type { AssumptionEntry } from "../common/types/result.js";
import type { TableModeInput, TableModeOutput } from "./types.js";

export function getMotorTableDataVersion(): string {
  const { id, revision } = motorTableDataset.metadata;
  return `${id}:${revision}`;
}

export function calculateMotorFromTable(input: TableModeInput): {
  value: TableModeOutput;
  formulaVariant: "table-mode-220V" | "table-mode-380V";
  assumptions: AssumptionEntry[];
} {
  const entry = getMotorTableEntryByKW(input.kW);

  if (entry === undefined) {
    throw new RangeError(`No exact motor table row found for ${input.kW} kW.`);
  }

  if (!isVoltageAvailable(entry, input.voltage)) {
    throw new RangeError(
      `Motor table row ${input.kW} kW does not provide a ${input.voltage} V current.`,
    );
  }

  const currentA =
    input.voltage === 220 ? entry.currentA_220V : entry.currentA_380V;

  if (currentA === null) {
    throw new RangeError(
      `Motor table row ${input.kW} kW does not provide a ${input.voltage} V current.`,
    );
  }

  return {
    formulaVariant:
      input.voltage === 220 ? "table-mode-220V" : "table-mode-380V",
    assumptions: [
      {
        field: "source",
        usedValue: "table",
        source: "estimated",
      },
    ],
    value: {
      mode: "table",
      kW: entry.kW,
      PS: entry.PS,
      cosPhi: entry.cosPhi,
      efficiencyPercent: entry.efficiencyPercent,
      currentA,
      cableSpec: entry.cableSpec,
    },
  };
}
