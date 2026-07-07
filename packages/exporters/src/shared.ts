import type { CalculationResult } from "../../calculation-core/dist/index.js";
import type { CalculationRecord } from "../../contracts/src/index.js";

export type CalculatorKind = CalculationRecord["calculator"];

export interface ExportedFile<Format extends string> {
  format: Format;
  mimeType: string;
  fileExtension: string;
  data: Uint8Array;
}

export interface FlatEntry {
  path: string;
  value: string | number | boolean | null;
}

export function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);

    if (codePoint === undefined) {
      continue;
    }

    if (codePoint > 0xffff) {
      index += 1;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
      continue;
    }

    if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
      continue;
    }

    if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
      continue;
    }

    bytes.push(0xf0 | (codePoint >> 18));
    bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
    bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
    bytes.push(0x80 | (codePoint & 0x3f));
  }

  return Uint8Array.from(bytes);
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function toDisplayString(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function flattenValue(value: unknown, prefix = ""): FlatEntry[] {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return [{ path: prefix || "value", value: value ?? null }];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [{ path: prefix || "value", value: "[]" }];
    }

    return value.flatMap((item, index) => flattenValue(item, `${prefix}[${index}]`));
  }

  const entries = Object.entries(value as Record<string, unknown>);

  if (entries.length === 0) {
    return [{ path: prefix || "value", value: "{}" }];
  }

  return entries.flatMap(([key, nestedValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return flattenValue(nestedValue, path);
  });
}

export function isCalculationResultLike<T>(value: unknown): value is CalculationResult<T> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CalculationResult<T>>;

  return (
    "value" in candidate &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.assumptions) &&
    typeof candidate.formulaVariant === "string" &&
    typeof candidate.dataVersion === "string" &&
    typeof candidate.engineVersion === "string"
  );
}

export function calculatorLabel(calculator: CalculatorKind): string {
  switch (calculator) {
    case "motor":
      return "Motor";
    case "voltage-drop":
      return "Voltage Drop";
    case "voltage-drop-group":
      return "Voltage Drop Group";
    case "cable":
      return "Cable";
    case "protection":
      return "Protection";
  }

  return calculator;
}

export function normalizeWorksheetName(calculator: CalculatorKind): string {
  const baseName = calculatorLabel(calculator);
  return baseName.slice(0, 31);
}

export interface RecordSectionRow {
  recordId: string;
  calculator: CalculatorKind;
  title: string;
  groupTitle: string;
  section: "input" | "output" | "assumption" | "warning";
  path: string;
  value: string;
  detail: string;
}

export function buildRecordSectionRows(record: CalculationRecord): RecordSectionRow[] {
  const title = record.title ?? "";
  const groupTitle = record.grouping?.groupTitle ?? "";
  const rows: RecordSectionRow[] = [];

  for (const entry of flattenValue(record.input, "input")) {
    rows.push({
      recordId: record.id,
      calculator: record.calculator,
      title,
      groupTitle,
      section: "input",
      path: entry.path,
      value: toDisplayString(entry.value),
      detail: "",
    });
  }

  if (isCalculationResultLike(record.output)) {
    for (const entry of flattenValue(record.output.value, "output")) {
      rows.push({
        recordId: record.id,
        calculator: record.calculator,
        title,
        groupTitle,
        section: "output",
        path: entry.path,
        value: toDisplayString(entry.value),
        detail: "",
      });
    }

    rows.push(
      {
        recordId: record.id,
        calculator: record.calculator,
        title,
        groupTitle,
        section: "output",
        path: "output.formulaVariant",
        value: record.output.formulaVariant,
        detail: "",
      },
      {
        recordId: record.id,
        calculator: record.calculator,
        title,
        groupTitle,
        section: "output",
        path: "output.dataVersion",
        value: record.output.dataVersion,
        detail: "",
      },
      {
        recordId: record.id,
        calculator: record.calculator,
        title,
        groupTitle,
        section: "output",
        path: "output.engineVersion",
        value: record.output.engineVersion,
        detail: "",
      },
    );

    record.output.assumptions.forEach((assumption, index) => {
      rows.push({
        recordId: record.id,
        calculator: record.calculator,
        title,
        groupTitle,
        section: "assumption",
        path: `assumptions[${index}].${assumption.field}`,
        value: toDisplayString(assumption.usedValue),
        detail: assumption.source,
      });
    });

    record.output.warnings.forEach((warning, index) => {
      rows.push({
        recordId: record.id,
        calculator: record.calculator,
        title,
        groupTitle,
        section: "warning",
        path: `warnings[${index}].${warning.code}`,
        value: warning.messageKey,
        detail: warning.detail ?? "",
      });
    });

    return rows;
  }

  for (const entry of flattenValue(record.output, "output")) {
    rows.push({
      recordId: record.id,
      calculator: record.calculator,
      title,
      groupTitle,
      section: "output",
      path: entry.path,
      value: toDisplayString(entry.value),
      detail: "",
    });
  }

  return rows;
}
