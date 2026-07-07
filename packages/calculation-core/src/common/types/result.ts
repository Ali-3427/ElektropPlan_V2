export interface CalculationResult<T> {
  value: T;
  warnings: WarningEntry[];
  assumptions: AssumptionEntry[];
  formulaVariant: string;
  dataVersion: string;
  engineVersion: string;
}

export interface WarningEntry {
  code: string;
  messageKey: string;
  detail?: string;
}

export interface AssumptionEntry {
  field: string;
  usedValue: number | string;
  source: "user" | "estimated" | "default";
}
