import { writeFile } from "node:fs/promises";

import { ENGINE_VERSION } from "@elektroplan/calculation-core";
import {
  calculationGroupSchema,
  calculationRecordSchema,
  type CalculationGroup,
  type CalculationRecord,
  type CalculationsExport,
} from "@elektroplan/contracts";
import {
  exportCalculationResultToJson,
  exportCalculationsToExcel,
  exportCalculationsToJson,
  exportPresentationToPdf,
  type JsonCalculationResultDocument,
  type PdfPresentationDocument,
} from "@elektroplan/exporters";
import { dialog } from "electron";

const CONTRACT_VERSION = "1.0.0";

export interface ExportBundle {
  readonly records?: readonly CalculationRecord[];
  readonly groups?: readonly CalculationGroup[];
  readonly resultDocument?: JsonCalculationResultDocument<unknown>;
}

export interface ExportPdfBundle {
  readonly presentation: PdfPresentationDocument;
}

export type ExportResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly path: string };

export interface ExportService {
  exportJson(bundle: unknown): Promise<ExportResult>;
  exportExcel(bundle: unknown): Promise<ExportResult>;
  exportPdf(bundle: unknown): Promise<ExportResult>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseRecords(value: unknown): CalculationRecord[] {
  if (!Array.isArray(value)) {
    throw new TypeError("records must be an array.");
  }
  return value.map((entry) => calculationRecordSchema.parse(entry));
}

function parseGroups(value: unknown): CalculationGroup[] {
  if (!Array.isArray(value)) {
    throw new TypeError("groups must be an array.");
  }
  return value.map((entry) => calculationGroupSchema.parse(entry));
}

function parseExportBundle(input: unknown): ExportBundle {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Export payload must be an object.");
  }

  const candidate = input as {
    records?: unknown;
    groups?: unknown;
    resultDocument?: unknown;
  };

  const bundle: {
    records?: CalculationRecord[];
    groups?: CalculationGroup[];
    resultDocument?: JsonCalculationResultDocument<unknown>;
  } = {};

  if (candidate.records !== undefined) {
    bundle.records = parseRecords(candidate.records);
  }
  if (candidate.groups !== undefined) {
    bundle.groups = parseGroups(candidate.groups);
  }
  if (candidate.resultDocument !== undefined) {
    const doc = candidate.resultDocument;
    if (typeof doc !== "object" || doc === null) {
      throw new TypeError("resultDocument must be an object.");
    }
    bundle.resultDocument = doc as JsonCalculationResultDocument<unknown>;
  }

  return bundle;
}

function parsePdfBundle(input: unknown): ExportPdfBundle {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("PDF export payload must be an object.");
  }
  const candidate = input as { presentation?: unknown };
  if (
    typeof candidate.presentation !== "object" ||
    candidate.presentation === null
  ) {
    throw new TypeError("PDF export payload must include a presentation object.");
  }
  return { presentation: candidate.presentation as PdfPresentationDocument };
}

function buildCalculationsExport(bundle: ExportBundle): CalculationsExport {
  return {
    version: {
      contractVersion: CONTRACT_VERSION,
      engineVersion: ENGINE_VERSION,
    },
    exportedAt: nowIso(),
    groups: [...(bundle.groups ?? [])],
    records: [...(bundle.records ?? [])],
  };
}

async function promptAndWrite(
  defaultName: string,
  extension: string,
  filterName: string,
  data: Uint8Array,
): Promise<ExportResult> {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions: [extension] }],
  });

  if (result.canceled || result.filePath === undefined) {
    return { canceled: true };
  }

  await writeFile(result.filePath, data);
  return { canceled: false, path: result.filePath };
}

export function createExportService(): ExportService {
  return {
    async exportJson(input) {
      const bundle = parseExportBundle(input);
      const file = bundle.resultDocument !== undefined
        ? exportCalculationResultToJson(bundle.resultDocument)
        : exportCalculationsToJson(buildCalculationsExport(bundle));
      return promptAndWrite(
        `elektroplan-export-${Date.now()}.json`,
        "json",
        "JSON",
        file.data,
      );
    },
    async exportExcel(input) {
      const bundle = parseExportBundle(input);
      const file = exportCalculationsToExcel(buildCalculationsExport(bundle));
      return promptAndWrite(
        `elektroplan-export-${Date.now()}.${file.fileExtension}`,
        file.fileExtension,
        "Excel (SpreadsheetML)",
        file.data,
      );
    },
    async exportPdf(input) {
      const bundle = parsePdfBundle(input);
      const file = exportPresentationToPdf(bundle.presentation);
      return promptAndWrite(
        `elektroplan-export-${Date.now()}.pdf`,
        "pdf",
        "PDF",
        file.data,
      );
    },
  };
}
