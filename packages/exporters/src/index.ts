export type { CalculationResult } from "../../calculation-core/dist/index.js";
export type {
  CalculationGroup,
  CalculationRecord,
  CalculationsExport,
  RecordVersion,
} from "../../contracts/src/index.js";
export type { CalculatorKind } from "./shared.js";

export { exportCalculationsToExcel } from "./excel.js";
export type { ExcelExportResult } from "./excel.js";

export { exportCalculationResultToJson, exportCalculationsToJson } from "./json.js";
export type {
  JsonCalculationResultDocument,
  JsonExportOptions,
  JsonMetadata,
} from "./json.js";

export { exportPresentationToPdf } from "./pdf.js";
export type {
  PdfExportResult,
  PdfPresentationDocument,
  PdfPresentationRecord,
  PdfPresentationRow,
  PdfPresentationSection,
} from "./pdf.js";

export type { ExportedFile } from "./shared.js";
