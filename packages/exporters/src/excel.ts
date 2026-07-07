import type { CalculationsExport, CalculationRecord } from "../../contracts/src/index.js";

import type { ExportedFile } from "./shared.js";
import {
  buildRecordSectionRows,
  type CalculatorKind,
  calculatorLabel,
  encodeUtf8,
  escapeXml,
  normalizeWorksheetName,
} from "./shared.js";

export interface ExcelExportResult extends ExportedFile<"excel"> {
  workbookFormat: "spreadsheetml-2003";
}

interface WorksheetCell {
  value: string | number | boolean;
  styleId?: "header" | "section" | "body";
}

function inferCellType(value: WorksheetCell["value"]): "String" | "Number" | "Boolean" {
  if (typeof value === "number") {
    return "Number";
  }

  if (typeof value === "boolean") {
    return "Boolean";
  }

  return "String";
}

function createCellXml(cell: WorksheetCell): string {
  const type = inferCellType(cell.value);
  const style = cell.styleId ? ` ss:StyleID="${cell.styleId}"` : "";
  const value = type === "String" ? escapeXml(String(cell.value)) : String(cell.value);

  return `<Cell${style}><Data ss:Type="${type}">${value}</Data></Cell>`;
}

function buildWorksheetXml(calculator: CalculatorKind, records: CalculationRecord[]): string {
  const rows: WorksheetCell[][] = [
    [
      { value: `${calculatorLabel(calculator)} Calculations`, styleId: "header" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
    ],
    [
      { value: "Record ID", styleId: "section" },
      { value: "Title", styleId: "section" },
      { value: "Group", styleId: "section" },
      { value: "Section", styleId: "section" },
      { value: "Path", styleId: "section" },
      { value: "Value", styleId: "section" },
      { value: "Detail", styleId: "section" },
    ],
  ];

  records.forEach((record) => {
    const flattenedRows = buildRecordSectionRows(record);

    if (flattenedRows.length === 0) {
      rows.push([
        { value: record.id },
        { value: record.title ?? "" },
        { value: record.grouping?.groupTitle ?? "" },
        { value: "output" },
        { value: "output" },
        { value: "" },
        { value: "" },
      ]);
      return;
    }

    flattenedRows.forEach((row) => {
      rows.push([
        { value: row.recordId },
        { value: row.title },
        { value: row.groupTitle },
        { value: row.section },
        { value: row.path },
        { value: row.value },
        { value: row.detail },
      ]);
    });
  });

  const rowXml = rows
    .map((row) => `<Row>${row.map((cell) => createCellXml(cell)).join("")}</Row>`)
    .join("");

  return [
    `<Worksheet ss:Name="${escapeXml(normalizeWorksheetName(calculator))}">`,
    "<Table>",
    '<Column ss:Width="120"/>',
    '<Column ss:Width="120"/>',
    '<Column ss:Width="120"/>',
    '<Column ss:Width="90"/>',
    '<Column ss:Width="220"/>',
    '<Column ss:Width="240"/>',
    '<Column ss:Width="180"/>',
    rowXml,
    "</Table>",
    "</Worksheet>",
  ].join("");
}

export function exportCalculationsToExcel(document: CalculationsExport): ExcelExportResult {
  const calculators: CalculatorKind[] = [
    "motor",
    "voltage-drop",
    "voltage-drop-group",
    "cable",
    "protection",
  ];
  const worksheets = calculators
    .map((calculator) => {
      const records = document.records.filter((record) => record.calculator === calculator);
      return buildWorksheetXml(calculator, records);
    })
    .join("");

  const xml = [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    "<Styles>",
    '<Style ss:ID="header"><Font ss:Bold="1" ss:Size="14"/></Style>',
    '<Style ss:ID="section"><Font ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="body"><Alignment ss:Vertical="Top"/></Style>',
    "</Styles>",
    worksheets,
    "</Workbook>",
  ].join("");

  return {
    format: "excel",
    workbookFormat: "spreadsheetml-2003",
    mimeType: "application/vnd.ms-excel",
    fileExtension: "xml",
    data: encodeUtf8(xml),
  };
}
