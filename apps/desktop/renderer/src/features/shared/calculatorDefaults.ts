import type {
  AssumptionEntry,
  MotorFormulaRequest,
  MotorPhase,
  MotorVoltageMode,
} from "../../bridge/types";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface ExampleNumericField<TField extends string> {
  readonly field: TField;
  readonly exampleValue: number;
}

export interface MotorFormulaSubmissionInput {
  readonly P_out: number | null;
  readonly cosPhi: number | null;
  readonly efficiencyPercent: number | null;
  readonly phase: MotorPhase;
  readonly voltageMode: MotorVoltageMode;
}

export interface MotorFormulaSubmission {
  readonly request: MotorFormulaRequest;
  readonly assumptions: AssumptionEntry[];
  readonly isValid: boolean;
}

const SQRT3 = Math.sqrt(3);
export const MOTOR_EFFICIENCY_PERCENT_MIN = 1;

function createPlaceholder(exampleValue: number): string {
  return `örn. ${exampleValue}`;
}

function resolveExampleDefault<TField extends string>(
  value: number | null,
  field: ExampleNumericField<TField>,
  assumptions: AssumptionEntry[],
): number {
  if (value !== null) {
    return value;
  }

  assumptions.push({
    field: field.field,
    usedValue: field.exampleValue,
    source: "default",
  });

  return field.exampleValue;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export const MOTOR_FORMULA_DEFAULTS = {
  P_out: 7.5,
  cosPhi: 0.85,
  efficiencyPercent: 80,
} as const;

const MOTOR_FORMULA_FIELDS = {
  P_out: { field: "P_out", exampleValue: MOTOR_FORMULA_DEFAULTS.P_out },
  cosPhi: { field: "cosPhi", exampleValue: MOTOR_FORMULA_DEFAULTS.cosPhi },
  efficiencyPercent: {
    field: "efficiencyPercent",
    exampleValue: MOTOR_FORMULA_DEFAULTS.efficiencyPercent,
  },
} as const;

export const MOTOR_FORMULA_PLACEHOLDERS = {
  P_out: createPlaceholder(MOTOR_FORMULA_DEFAULTS.P_out),
  cosPhi: createPlaceholder(MOTOR_FORMULA_DEFAULTS.cosPhi),
  efficiencyPercent: createPlaceholder(MOTOR_FORMULA_DEFAULTS.efficiencyPercent),
} as const;

export const MOTOR_PHASE_OPTIONS: DropdownOption[] = [
  { value: "1", label: "Tek Fazlı (1Φ)" },
  { value: "3", label: "Üç Fazlı (3Φ)" },
];

export const MOTOR_VOLTAGE_MODE_OPTIONS: DropdownOption[] = [
  { value: "LL", label: "Hat-Hat (LL)" },
  { value: "LN", label: "Hat-Nötr (LN)" },
];

const MOTOR_VOLTAGE_OPTIONS_BY_PHASE: Record<MotorPhase, DropdownOption[]> = {
  1: [{ value: "220", label: "220 V" }],
  3: [{ value: "380", label: "380 V" }],
};

export function getMotorFormulaVoltageOptions(phase: MotorPhase): DropdownOption[] {
  return MOTOR_VOLTAGE_OPTIONS_BY_PHASE[phase];
}

export function getMotorFormulaVoltageForPhase(phase: MotorPhase): 220 | 380 {
  return phase === 1 ? 220 : 380;
}

export function buildMotorFormulaSubmission(
  input: MotorFormulaSubmissionInput,
): MotorFormulaSubmission {
  const assumptions: AssumptionEntry[] = [];

  const P_out = resolveExampleDefault(input.P_out, MOTOR_FORMULA_FIELDS.P_out, assumptions);
  const cosPhi = resolveExampleDefault(input.cosPhi, MOTOR_FORMULA_FIELDS.cosPhi, assumptions);
  const efficiencyPercent = resolveExampleDefault(
    input.efficiencyPercent,
    MOTOR_FORMULA_FIELDS.efficiencyPercent,
    assumptions,
  );

  const selectedVoltage = getMotorFormulaVoltageForPhase(input.phase);
  const voltage =
    input.phase === 3 && input.voltageMode === "LN"
      ? selectedVoltage / SQRT3
      : selectedVoltage;

  const request: MotorFormulaRequest = {
    mode: "formula",
    phase: input.phase,
    P_out,
    voltage,
    cosPhi,
    efficiencyPercent,
    ...(input.phase === 3 ? { voltageMode: input.voltageMode } : {}),
  };

  const isValid =
    isPositiveFinite(P_out) &&
    isPositiveFinite(voltage) &&
    isPositiveFinite(cosPhi) &&
    cosPhi <= 1 &&
    isPositiveFinite(efficiencyPercent) &&
    efficiencyPercent >= MOTOR_EFFICIENCY_PERCENT_MIN &&
    efficiencyPercent <= 100;

  return { request, assumptions, isValid };
}

export const CALCULATOR_EXAMPLE_DEFAULTS = {
  cable: {
    designCurrentA: 45,
    ambientTemperatureC: 30,
    groupedCircuits: 1,
    thirdHarmonicPercent: 0,
    voltageDropLimitPercent: 4,
  },
  voltageDrop: {
    lengthM: 50,
    sectionMm2: 16,
    baseVoltageV: 380,
    currentA: 45,
    powerKW: 22,
    cosPhi: 0.85,
    parallelConductors: 1,
    conductorTempC: 70,
    reactanceOhmPerKm: 0.08,
  },
} as const;

export const CABLE_DEFAULTS = CALCULATOR_EXAMPLE_DEFAULTS.cable;
export const VOLTAGE_DROP_DEFAULTS = CALCULATOR_EXAMPLE_DEFAULTS.voltageDrop;

export function examplePlaceholder(value: number): string {
  return `örn. ${value}`;
}

export interface DefaultedNumber {
  readonly value: number;
  readonly assumptions: AssumptionEntry[];
}

export function normalizeExampleNumber(
  value: number | null,
  defaultValue: number,
  field: string,
): DefaultedNumber {
  if (value === null) {
    return {
      value: defaultValue,
      assumptions: [
        {
          field,
          usedValue: defaultValue,
          source: "default",
        },
      ],
    };
  }

  return { value, assumptions: [] };
}

export function mergeAssumptions(
  ...parts: Array<readonly AssumptionEntry[] | undefined>
): AssumptionEntry[] {
  const merged: AssumptionEntry[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (!part || part.length === 0) continue;

    for (const entry of part) {
      const key = `${entry.field}|${entry.source}|${String(entry.usedValue)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
  }

  return merged;
}
